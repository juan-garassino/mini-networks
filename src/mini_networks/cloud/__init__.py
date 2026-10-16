"""Cloud side of the lab: train dispatch via Pub/Sub (publisher), parallel-sweep
task sharding + report merge (sweep_shard), and Production champion pulls
(champions). Cloud SDK imports are lazy, so the package imports without the
``cloud`` extra."""
