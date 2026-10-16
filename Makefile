.PHONY: help install install-dev test test-ci clean list validate-s validate-m validate-l validate-models-s validate-compositions-s playground playground-dev playground-ports playground-install lab-shoot lab-board

UV_RUN = uv run
PYTHON ?= $(UV_RUN) python
CHECKPOINT_ROOT ?= runs
DATA_ROOT ?= data
DEVICE ?= cpu
BATCH_SIZE ?= 32
EPOCHS ?= 2

help:
	@echo "Available targets:"
	@echo "  install               Install runtime dependencies with uv"
	@echo "  install-dev           Install runtime + dev dependencies with uv"
	@echo "  test                  Run fast test suite (slow tests deselected)"
	@echo "  test-ci               Run tests for CI"
	@echo "  clean                 Remove caches and stray run output"
	@echo "  list                  List available models and compositions"
	@echo "  validate-s            Run full sweep at tier S"
	@echo "  validate-m            Run full sweep at tier M"
	@echo "  validate-l            Run full sweep at tier L"
	@echo "  validate-models-s     Run models-only sweep at tier S"
	@echo "  validate-compositions-s Run compositions-only sweep at tier S"
	@echo ""
	@echo "Variables:"
	@echo "  CHECKPOINT_ROOT=$(CHECKPOINT_ROOT)"
	@echo "  DATA_ROOT=$(DATA_ROOT)"
	@echo "  DEVICE=$(DEVICE)"
	@echo "  BATCH_SIZE=$(BATCH_SIZE)"
	@echo "  EPOCHS=$(EPOCHS)"

install:
	uv sync

install-dev:
	uv sync --dev

test:
	$(UV_RUN) pytest -q

test-ci:
	$(UV_RUN) pytest -q

clean:
	rm -rf .pytest_cache .ruff_cache
	find . -name "__pycache__" -not -path "./legacy/*" -not -path "./.venv/*" -type d -prune -exec rm -rf {} +

list:
	$(PYTHON) main.py list

# --- playground (Next.js static export served by FastAPI at /) ---
playground-install:
	cd playground && npm install

playground:
	cd playground && npm run build   # → playground/out, served by `python main.py serve`

playground-dev:
	# :3000, hot reload; bound to the LAN so the owner's phone can open it too
	cd playground && NEXT_PUBLIC_API_BASE=http://$$(ipconfig getifaddr en0 2>/dev/null || echo localhost):8000 npm run dev -- -H 0.0.0.0

playground-ports:
	cd playground && node scripts/ports.mjs  # one port per UI (3001..3010) over the :3000 dev server

# --- lab bake-off (headless-Chrome shots of /lab/<skin> → playground/.lab-shots) ---
lab-shoot:
	@if [ -z "$(SKIN)" ]; then echo "Usage: make lab-shoot SKIN=paper ROUND=1"; exit 1; fi
	cd playground && node scripts/shoot.mjs --skin $(SKIN) --round $(ROUND)

lab-board:
	cd playground && node scripts/board.mjs   # → playground/.lab-shots/board.html

validate-s:
	$(PYTHON) main.py sweep --check --training_tier S --batch_size $(BATCH_SIZE) --epochs $(EPOCHS) --device $(DEVICE) --data_root $(DATA_ROOT) --checkpoint_root $(CHECKPOINT_ROOT)

validate-m:
	$(PYTHON) main.py sweep --check --training_tier M --batch_size $(BATCH_SIZE) --epochs $(EPOCHS) --device $(DEVICE) --data_root $(DATA_ROOT) --checkpoint_root $(CHECKPOINT_ROOT)

validate-l:
	$(PYTHON) main.py sweep --check --training_tier L --batch_size $(BATCH_SIZE) --epochs $(EPOCHS) --device $(DEVICE) --data_root $(DATA_ROOT) --checkpoint_root $(CHECKPOINT_ROOT)

validate-models-s:
	$(PYTHON) main.py sweep --check --training_tier S --skip-compositions --batch_size $(BATCH_SIZE) --epochs $(EPOCHS) --device $(DEVICE) --data_root $(DATA_ROOT) --checkpoint_root $(CHECKPOINT_ROOT)

validate-compositions-s:
	$(PYTHON) main.py sweep --check --training_tier S --skip-models --batch_size $(BATCH_SIZE) --epochs $(EPOCHS) --device $(DEVICE) --data_root $(DATA_ROOT) --checkpoint_root $(CHECKPOINT_ROOT)
