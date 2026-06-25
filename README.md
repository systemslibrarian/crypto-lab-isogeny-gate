# crypto-lab-isogeny-gate

A browser demo of **isogeny-based cryptography**: a real (but tiny) commutative
isogeny key exchange, the supersingular isogeny graph it walks, and the story of
the scheme that fell. Every number on the page is computed live with exact
BigInt arithmetic over `GF(419)` — none of it is mocked.

## What It Is

Elliptic-curve isogenies are non-trivial maps between elliptic curves that
preserve the group structure. They underpin a family of post-quantum proposals
whose security rests on the hardness of finding a path between two curves in a
supersingular isogeny graph.

This demo implements a **toy CSIDH** — a genuine commutative group-action key
exchange — and uses it to tell the cautionary tale of **SIDH**, the related
scheme that was a NIST candidate for a decade until the **Castryck–Decru attack**
(August 2022) broke it in minutes.

### What is real here, and what is not

| Component | Status |
|---|---|
| Field & curve arithmetic over `GF(p)` (`ec.ts`) | **Real**, exact BigInt |
| Vélu ℓ-isogeny codomains | **Real** (classical Vélu formulas) |
| Supersingularity / point counting | **Real** (`#E = p+1`) |
| CSIDH key exchange (`csidh.ts`) | **Real** group action; Alice and Bob provably agree |
| Isogeny graph (`graph.ts`) | **Real**, built by walking actual isogenies |
| Brute-force key recovery | **Real** exhaustive search over the toy key space |
| Castryck–Decru attack itself | **Not implemented** — explained in prose (it needs higher-genus gluing via Kani's lemma; far beyond a toy) |

The parameters (`p = 419`, ℓ ∈ {5, 7}) are chosen for visibility and are
trivially breakable. **This is a teaching tool, not a cryptographic library.**

## Why CSIDH, to tell SIDH's story?

SIDH and CSIDH are cousins. SIDH had each party publish, alongside their curve,
the **images of torsion points** under their secret isogeny. Those images were
believed safe for ten years — and were exactly what Castryck and Decru used to
reconstruct the secret. CSIDH publishes **only a curve**, no torsion images, so
that specific attack does not apply to it. Demonstrating a working CSIDH and then
explaining what extra information sank SIDH is the most honest way to show *why*
beautiful, well-scrutinised math can still fail.

## Live Demo

**[https://systemslibrarian.github.io/crypto-lab-isogeny-gate/](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/)**

Five interactive exhibits:

1. **What is an isogeny?** — Computes a real ℓ-isogeny with Vélu's formulas and
   plots the point clouds of the domain and codomain curves.
2. **The isogeny graph** — The real supersingular isogeny graph over `GF(419)`;
   the button walks a genuine random path (a CSIDH group-action walk).
3. **CSIDH key exchange** — Alice and Bob run the real protocol and land on the
   same shared curve; agreement is checked at runtime.
4. **The gate: breaking it** — Brute-forces a working secret for Alice's public
   key, and explains the real Castryck–Decru break of SIDH.
5. **Lessons for PQC design** — Five principles drawn from the SIDH story.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-isogeny-gate
cd crypto-lab-isogeny-gate
npm install
npm run dev        # http://localhost:5173/
```

Other scripts:

```bash
npm test           # run the test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
```

The test suite verifies the mathematics that matters: the group law, the Hasse
bound, supersingularity, that Vélu codomains stay supersingular, that the
group action commutes, that Alice and Bob always agree, and that the brute-force
recovery reproduces the public key.

## When to Use It

- **Teaching post-quantum cryptography** — isogenies are a different foundation
  from lattices or hashes; this shows why NIST's multi-family approach matters.
- **Understanding structure-breaking attacks** — Castryck–Decru was not a
  parameter-tuning failure; it exploited auxiliary data that looked harmless.
- **When NOT to use it** — never use SIDH/SIKE in production, and do not use this
  toy for anything real. For key encapsulation use **ML-KEM** (NIST FIPS 203).

## Part of the Crypto-Lab Suite

One of 60+ live browser demos at
[systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
— spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
