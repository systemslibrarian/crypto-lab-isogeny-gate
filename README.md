# crypto-lab-isogeny-gate

## What It Is

A browser demo of **isogeny-based cryptography**: a real (but tiny) commutative
isogeny key exchange, the supersingular isogeny graph it walks, and the story of
the scheme that fell. Every number on the page is computed live with exact
BigInt arithmetic over `GF(419)` — none of it is mocked.

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
| Vélu ℓ-isogeny point images `φ(P)` (`ec.ts`) | **Real** (Vélu image formula; the map animated in Exhibit 1) |
| Supersingularity / point counting | **Real** (`#E = p+1`) |
| CSIDH key exchange (`csidh.ts`) | **Real** group action; Alice and Bob provably agree |
| Isogeny graph (`graph.ts`) | **Real**, built by walking actual isogenies |
| Brute-force key recovery | **Real** exhaustive search over the toy key space |
| Castryck–Decru attack itself | **Not implemented** — explained in prose (it needs higher-genus gluing via Kani's lemma; far beyond a toy) |

The parameters (`p = 419`, ℓ ∈ {5, 7}) are chosen for visibility and are
trivially breakable. **This is a teaching tool, not a cryptographic library.**

## When to Use It

- **Teaching post-quantum cryptography** — isogenies are a different foundation
  from lattices or hashes; this shows why NIST's multi-family approach matters.
- **Understanding structure-breaking attacks** — Castryck–Decru was not a
  parameter-tuning failure; it exploited auxiliary data that looked harmless.
- **Do NOT use it for anything real** — never use SIDH/SIKE in production, and do
  not use this toy for anything real. For key encapsulation use **ML-KEM** (NIST FIPS 203).

## Live Demo

**[systemslibrarian.github.io/crypto-lab-isogeny-gate](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/)**

A plain-language primer frames the whole journey, and load-bearing jargon
(*j-invariant*, *expander*, *group action*, *commutes*, *torsion images*, *Kani's
lemma*, *abelian surface*) is glossed inline on first use — introduced, not
assumed — so a newcomer has an on-ramp while the real mathematics is untouched.

Five interactive exhibits:

1. **What is an isogeny?** — Computes a real ℓ-isogeny with Vélu's formulas and
   **animates the map itself**: every domain point travels to its image `φ(P)`
   (via a real Vélu point-evaluation), the kernel subgroup visibly collapses to
   the identity, and a preserved addition `φ(P+Q) = φ(P)+φ(Q)` is verified live —
   so "group homomorphism" is shown, not asserted.
2. **The isogeny graph** — The real supersingular isogeny graph over `GF(419)`.
   **Build a walk one edge at a time** with `+1 ℓ-isogeny` buttons and watch the
   running exponent vector — which *is* a CSIDH secret — assemble; or walk a
   genuine random path.
3. **CSIDH key exchange** — Alice and Bob run the real protocol **as animated
   walks on the same graph**: two paths leave `E₀`, then each re-walks from the
   other's endpoint and both close on one shared vertex — the commuting diamond
   made visible. Agreement is checked at runtime.
4. **The gate: breaking it** — Shows the **key space as a grid** of candidate
   `(5^i, 7^j)` vectors and lights up each cell as brute force tests it until one
   matches — making the toy-scale caveat concrete — and explains the real
   Castryck–Decru break of SIDH (explicitly *not* what the brute force does).
5. **Lessons for PQC design** — Five principles drawn from the SIDH story.

## What Can Go Wrong

- **Auxiliary data can be the weakness.** SIDH published the images of torsion points under each party's secret isogeny; those images looked harmless for a decade and were exactly what the Castryck–Decru attack used to recover the secret.
- **Long scrutiny is not proof of security.** SIDH/SIKE survived ten years of analysis and multiple NIST rounds before a fast *classical* break ended it.
- **Toy parameters offer no security.** This demo's `GF(419)` field and tiny key space are for visibility only and are exhaustively breakable.
- **CSIDH is subtle in its own right.** Concrete CSIDH security levels and constant-time implementations of the group action remain actively studied; "the SIDH attack does not apply" is not the same as "fast and safe at scale."

## Real-World Usage

- **SIDH/SIKE** was a NIST PQC alternate KEM candidate until the 2022 Castryck–Decru attack; it is no longer recommended for any use.
- **CSIDH** is studied as a compact, commutative isogeny key exchange with very small keys, of ongoing academic interest.
- **SQIsign** is an isogeny-based signature submitted to NIST's additional-signatures process, notable for very small signatures.
- **Isogeny machinery** — including the higher-dimensional isogeny techniques behind the SIDH break — is now an active research tool across cryptography and number theory.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-isogeny-gate
cd crypto-lab-isogeny-gate
npm install
npm run dev
```

## Related Demos

- [crypto-lab-pq-families](https://systemslibrarian.github.io/crypto-lab-pq-families/) — the lattice / code / hash / multivariate / isogeny PQ landscape this demo sits in.
- [crypto-lab-kyber-vault](https://systemslibrarian.github.io/crypto-lab-kyber-vault/) — ML-KEM (FIPS 203), the lattice KEM recommended in place of SIDH.
- [crypto-lab-mceliece-gate](https://systemslibrarian.github.io/crypto-lab-mceliece-gate/) — Classic McEliece, a code-based PQ KEM from another family.
- [crypto-lab-multivariate](https://systemslibrarian.github.io/crypto-lab-multivariate/) — UOV multivariate signatures, another non-lattice PQ family.
- [crypto-lab-lll-break](https://systemslibrarian.github.io/crypto-lab-lll-break/) — LLL/BKZ lattice reduction, the structure-breaking attack tradition in another PQ family.

## Why CSIDH, to tell SIDH's story?

SIDH and CSIDH are cousins. SIDH had each party publish, alongside their curve,
the **images of torsion points** under their secret isogeny. Those images were
believed safe for ten years — and were exactly what Castryck and Decru used to
reconstruct the secret. CSIDH publishes **only a curve**, no torsion images, so
that specific attack does not apply to it. Demonstrating a working CSIDH and then
explaining what extra information sank SIDH is the most honest way to show *why*
beautiful, well-scrutinised math can still fail.

## Testing

```bash
npm test           # run the test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
```

The test suite verifies the mathematics that matters: the group law, the Hasse
bound, supersingularity, that Vélu codomains stay supersingular, that Vélu image
points land on the codomain and that φ is a genuine homomorphism (the property
Exhibit 1 animates), that the whole kernel collapses to the identity, that the
group action commutes, that Alice and Bob always agree, and that the brute-force
recovery reproduces the public key.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
