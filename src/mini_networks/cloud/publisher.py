"""Train-request publisher.

The Lab view / CLI publishes a JobSpec to a Pub/Sub topic; an out-of-process
Cloud Function launches the ephemeral Cloud Run Job (see infra/gcp/). The
google-cloud-pubsub import is lazy so the base package imports without the
``cloud`` extra installed. When unconfigured, ``NullPublisher`` fails loudly
rather than silently dropping a request.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


class JobSpec(BaseModel):
    """One cloud train request; serialised as JSON for the Pub/Sub message body."""

    model: str
    tier: str = "M"
    hparams: dict[str, Any] = Field(default_factory=dict)  # config field overrides
    run_name: str


@runtime_checkable
class Publisher(Protocol):
    """Anything that can dispatch a JobSpec and return a message id."""

    def publish(self, spec: JobSpec) -> str:
        """Dispatch ``spec``; return the backend's message id."""
        ...


class NullPublisher:
    """Placeholder used when ``MN_PUBSUB_TOPIC`` is unset."""

    def publish(self, spec: JobSpec) -> str:
        """Always raise RuntimeError explaining which env vars to set."""
        raise RuntimeError(
            "Cloud train backend not configured: set MN_PUBSUB_TOPIC and GOOGLE_CLOUD_PROJECT"
        )


class PubSubPublisher:
    """Publishes JobSpecs to Google Pub/Sub.

    ``topic``/``project`` default to ``MN_PUBSUB_TOPIC`` / ``GOOGLE_CLOUD_PROJECT``.
    A topic containing "/" is treated as a full ``projects/<p>/topics/<t>`` path.
    """

    def __init__(self, topic: str | None = None, project: str | None = None):
        self.topic = topic or os.environ.get("MN_PUBSUB_TOPIC")
        self.project = project or os.environ.get("GOOGLE_CLOUD_PROJECT")

    def publish(self, spec: JobSpec) -> str:
        """Publish ``spec`` as JSON and block (up to 30 s) for the Pub/Sub message id."""
        from google.cloud import pubsub_v1  # lazy; needs the `cloud` extra

        client = pubsub_v1.PublisherClient()
        topic_path = self.topic if "/" in (self.topic or "") else client.topic_path(self.project, self.topic)
        future = client.publish(topic_path, spec.model_dump_json().encode("utf-8"))
        msg_id = future.result(timeout=30)
        log.info("Published train request %s for %s (msg %s)", spec.run_name, spec.model, msg_id)
        return msg_id


def get_publisher() -> Publisher:
    """PubSubPublisher when ``MN_PUBSUB_TOPIC`` is set, else NullPublisher."""
    if os.environ.get("MN_PUBSUB_TOPIC"):
        return PubSubPublisher()
    return NullPublisher()
