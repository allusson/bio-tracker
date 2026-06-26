# bio-tracker — Claude Code Instructions

## Project overview
Unsupervised indoor BLE localization pipeline. See `docs/context/` for full
module documentation. The authoritative combined context file is
`docs/context/all.md` (concatenation of root.md, synthetic_data.md,
real_data.md, pipeline.md, utils.md, analysis.md, demo.md).

## Documentation rules

These apply automatically after any code change — do not wait to be asked.

1. **Per-module README.md**: After editing any file in `src/pipeline/`,
   `data/synthetic_data/`, `data/real_data/`, `utils/`, or `notebooks/`, check whether
   the corresponding `README.md` in that directory is still accurate. Update
   it if anything has changed (function signatures, behavior, status).

2. **docs/context/ files**: Each module has a corresponding context doc:
   - `src/pipeline/` → `docs/context/pipeline.md`
   - `data/real_data/` → `docs/context/real_data.md`
   - `utils/` → `docs/context/utils.md`
   - `data/synthetic_data/` → `docs/context/synthetic_data.md` (if it exists)
   - `notebooks/` → `docs/context/analysis.md` (if it exists)
   - repo root / config.py → `docs/context/root.md`
   After any change, update the relevant context doc to reflect it. Be precise
   and terse — these docs are machine-read as well as human-read.

3. **Module status line in `docs/context/root.md`**: The "Module statuses"
   paragraph must reflect the current implementation state of every module.
   Update it whenever a stub becomes implemented or an implemented module
   changes substantially.

4. **Docstrings**: Every function must have a docstring. After editing a
   function, verify its docstring matches current behavior. If the function
   is a stub, the docstring should say so explicitly.

5. **config.py gotchas**: If you add, remove, or change a config variable in
   either `config.py`, also update the config description in
   `docs/context/root.md`. The two must stay in sync.

## Code rules

- `utils/helpers.py` contains pseudocode stubs that Raphael is implementing
  himself as Python practice. **Do not complete these stubs.** You may read
  them, explain them, or suggest fixes if Raphael asks, but never write the
  implementation unprompted.
- Always sort by `reported_scan_timestamp` before passing data into
  `wrangler.py`. `aggfunc="last"` reflects row order, not chronological order.
- Never query `gateway_id = 'bio_id_test_scan_results'` in real data.
- `.env` files use plain `KEY=VALUE` format — no quotes, no spaces around `=`.
- `load_dotenv("../.env")` must be the first cell in every notebook.
- Use `databricks-sql-connector` (`from databricks import sql`), not
  `databricks-sdk`.

## Commit rules

- Do not commit `.env`, `__pycache__/`, or `outputs/` (except
  `.gitkeep`).
- Commit messages should be imperative, lowercase, under 72 chars.
- After any commit that changes a module's behavior, verify the relevant
  context doc was updated in the same commit.