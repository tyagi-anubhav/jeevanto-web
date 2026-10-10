@noble/hashes 1.4.0 (MIT, Paul Miller), the eight ES modules scrypt needs, copied from the npm tarball
(integrity sha512-V1JJ1WTRUqHHrOSh597hURcMqVKVGL/ea3kv0gSnEdsEZ0/+VyPghM1lMNGc00z7CIQorSvbKpuJkxvuHbvdbg==, checked 10 Oct 2026).
The one change: utils.js imports ./crypto.js instead of the bare "@noble/hashes/crypto", so a browser can load it.
Source maps dropped. The same build as ENGINES uses (supabase/functions/_shared/locked-copy.ts), so the key is byte-identical.
