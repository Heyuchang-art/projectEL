# Third-Party Licenses

This document lists third-party software components included in or distributed
with Snapshot Pi, along with their respective licenses and copyright notices.

---

## Bundled/Vendored Code

### Microsoft TypeScript __reflect Polyfill

- **Source**: `napcat/napcat/napcat.mjs` (lines 3108–3946)
- **License**: Apache License 2.0
- **Copyright**: Copyright (C) Microsoft. All rights reserved.
- **License Text**: See `napcat/napcat/LICENSE-APACHE-2.0.txt`

This code is the `__reflect` / `Reflect` decorator polyfill extracted from the
TypeScript compiler. It is bundled as part of the NapCat QQ framework's
compiled output.

---

## npm Dependencies

The following npm packages used by this project are licensed under the
Apache License 2.0. Their full license texts are available in their
respective `node_modules/<package>/LICENSE` files.

### Production Dependencies (Apache 2.0)

| Package | Version Range | Notes |
|---------|--------------|-------|
| `puppeteer` | ^22.x | Headless browser via pi-sdk |
| `express` | ^5.0.0 | HTTP server framework (NapCat) |
| `ws` | ^8.18.3 | WebSocket library (NapCat) |
| `google-logging-utils` | * | Google Cloud logging (pi-sdk) |
| `gaxios` | * | Google API HTTP client (pi-sdk) |
| `gcp-metadata` | * | GCP metadata client (pi-sdk) |
| `jwa` | * | JSON Web Algorithms (pi-sdk) |
| `jws` | * | JSON Web Signatures (pi-sdk) |
| `json-bigint` | * | BigInt JSON parsing (pi-sdk) |
| `agent-base` | * | HTTP agent base (pi-sdk) |
| `long` | * | Long integer support (pi-sdk) |
| `fast-xml-builder` | * | XML builder (pi-sdk) |
| `path-expression-matcher` | * | Path expression matching (pi-sdk) |
| `fetch-blob` | * | Blob fetch polyfill (pi-sdk) |
| `formdata-polyfill` | * | FormData polyfill (pi-sdk) |
| `node-domexception` | * | DOMException polyfill (pi-sdk) |
| `iconv-lite` | * | Character encoding (NapCat) |
| `qs` | * | Query string parser (NapCat) |

*Note: This is a representative list. For a complete audit, run:*
```
npx license-checker --production --summary
```

---

## Other Third-Party Components

### NapCatQQ Framework

- **Source**: `napcat/` directory
- **Upstream**: [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ)
- **License**: Custom restrictive license (non-commercial, educational use)
- **Key Terms**:
  - Prohibits unauthorized commercial use
  - Requires preservation of original copyright and license notices
  - Modifications must not be publicly distributed without authorization
  - Third-party library code within NapCat follows its original open-source licenses

### Pi Agent SDK

- **Source**: `pi-sdk/` directory
- **License**: MIT
- **Package**: `@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core`

### React Flow

- **Source**: npm dependency
- **License**: MIT

### KaTeX

- **Source**: npm dependency
- **License**: MIT

### QR Code Generator (TypeScript)

- **Source**: Bundled in NapCat web UI (`napcat/napcat/static/assets/qq_login-*.js`)
- **License**: MIT
- **Copyright**: Copyright (c) Project Nayuki.

### React & React DOM

- **Source**: Bundled in NapCat web UI
- **License**: MIT
- **Copyright**: Copyright (c) Meta Platforms, Inc. and affiliates.

---

## License Compliance Notes

1. All bundled third-party code retains its original copyright headers and
   license notices in the source files.
2. The full text of the Apache License 2.0 is provided at
   `napcat/napcat/LICENSE-APACHE-2.0.txt`.
3. For npm dependencies, each package's license text is available in its
   `node_modules/<package>/LICENSE` file.
4. This project itself is licensed under the MIT License — see `LICENSE`
   at the repository root.

---

*Last updated: 2026-06-10*
