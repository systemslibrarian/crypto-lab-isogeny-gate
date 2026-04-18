# crypto-lab-isogeny-gate

**Browser-based educational demo covering the complete arc of isogeny-based cryptography: from the elegant mathematics of elliptic curve isogenies, through SIDH/SIKE's decade of promise as a post-quantum KEM, to the catastrophic Castryck-Decru break of August 2022, to the modern survivors (CSIDH, SQIsign) that were unaffected.**

> "Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God."
> — 1 Corinthians 10:31

## What It Is

This demo tells the story of security assumptions collapsing not from theoretical weakness, but from the emergence of new mathematical tools.

**The arc:**
- **2011–2022** (ACT 1): SIDH proposed. 10 years of scrutiny. No breaks. NIST Round 4.
- **August 5, 2022** (ACT 2): Castryck & Decru. One hour on a laptop. SIKE withdrawn.
- **2024–2025** (ACT 3): CSIDH under scrutiny. SQIsign in NIST Round 2. The path survives differently.

## Live Demo

[https://systemslibrarian.github.io/crypto-lab-isogeny-gate/](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/)

## Core Lessons

1. **Auxiliary Information Is Attack Surface.** SIDH required torsion point images for interop. Seemed transparent. Was fatal.
2. **Elegance ≠ Security.** Isogenies are mathematically beautiful. Beauty and years of scrutiny are not proofs.
3. **Different Problems, Different Fates.** The SI-Path problem (SQIsign) survived. Only SI-DH fell.
4. **Attacks Become Tools.** Castryck-Decru Higher-dimensional isogeny techniques now improve the scheme that survived.
5. **Diversity Is Essential.** NIST's multi-family approach (lattice, hash, code, isogeny-candidates) prevented a single collapse.

## Technical Stack

- **Vite** + **TypeScript** (strict)
- **Vanilla CSS** (dark/light theme)
- **Canvas 2D** (all visualizations)
- **BigInt** (exact modular arithmetic, no floating point)
- **crypto.getRandomValues** (no Math.random)
- **GitHub Pages** (no backend)
- **Zero external libraries**

## What's Implemented

### Phase 1: Elliptic Curve Arithmetic (`src/ec.ts`)
- Point addition, scalar multiplication over GF(p)
- Modular inversion (Fermat), modular exponentiation
- Tonelli-Shanks for square roots
- Point enumeration (small p only)
- Vélu's isogeny formula
- j-invariant computation
- Supersingularity check

### Phase 2: Toy SIDH (`src/sidh.ts`)
- Simplified SIDH key generation (Alice & Bob)
- Shared secret computation
- **Castryck-Decru toy attack**: recovers secret from torsion images via brute-force candidate search
- Demonstrates structure even with simplified arithmetic

### Phase 3: Isogeny Graph (`src/isogeny-graph.ts`)
- Basic graph structure: nodes (j-invariants), edges (isogenies)
- Random walks on the expander graph
- Canvas visualization with path highlighting

### Phase 4: Interactive UI (`src/main.ts`)
- **Exhibit 1**: What is an isogeny? (definition + diagram)
- **Exhibit 2**: The isogeny graph (expander graph visualization)
- **Exhibit 3**: SIDH key exchange (protocol simulation)
- **Exhibit 4**: Castryck-Decru attack (step-by-step recovery)
- **Exhibit 5**: Lessons for PQC design (five principles)
- Dark/light theme toggle
- Responsive layout (mobile-first)

### Phase 6: Accessibility & Polish
- **WCAG 2.1 AA**: aria-labels on canvases, semantic time elements
- **Dark/light theme**: localStorage persistence
- **Mobile-first**: 320px–1440px responsive
- **Scripture footer** (verbatim 1 Corinthians 10:31)

### Phase 7: Verification (Final Checklist)
```
✓ npm run build — zero TypeScript errors
✓ EC point addition & scalar mul correct over GF(71)
✓ Vélu isogeny: kernel maps to identity
✓ SIDH exchange: both parties compute same shared secret
✓ Castryck-Decru: recovers Alice's secret from public key
✓ Isogeny graph: correct structure (no test failures)
✓ No Math.random() anywhere
✓ No claims CSIDH/SQIsign are proven secure
✓ No claims SQIsign is standardized (Round 2 only)
✓ Timeline dates accurate (August 5, 2022 for attack)
```

## Warnings & Disclaimers

- **TOY PARAMETERS:** p=71. Real SIKE: p = 2^a * 3^b - 1 (a,b~216). Do NOT derive security from toy primes.
- **SIKE/SIDH:** Insecure. No parameter set is safe. (NIST official statement.)
- **CSIDH:** Subexponential classical attacks known. Security parameters debated. Not NIST standardized.
- **SQIsign v2.0:** NIST Round 2 (2025), under active cryptanalysis. NOT standardized. Experimental.
- **Attack Implementation:** Toy Castryck-Decru uses brute-force candidate search. Real attack: Kani's producibility criterion (higher-dimensional isogenies). Principles identical; scale differs.

## Real-World Usage

**For Post-Quantum Key Exchange:** Use ML-KEM (FIPS 203).

**For Small-Key Signatures with Quantum Resistance:** Monitor SQIsign standardization.

**For Diversity:** BIKE and HQC (code-based, NIST Round 4 alternates).

## Deployment

```bash
npm install
npm run build
# distributes to ./dist/
# GitHub Pages: push to gh-pages branch
```

## Anti-Hallucination Rules

- No `Math.random()` — ever. `crypto.getRandomValues()` only.
- No production SIDH/SIKE implementation.
- Torsion leak: explicitly stated as SIDH's vulnerability (not broader).
- SQIsign status: Round 2 candidate (not proven, not standardized).
- Isogeny PATH problem: survived, undamaged. Only EXCHANGE (SIDH) broke.

## Repository Information

- **Owner:** systemslibrarian
- **Repo:** crypto-lab-isogeny-gate
- **Topics:** cryptography, post-quantum, isogeny, SIDH, SIKE, Castryck-Decru, SQIsign, CSIDH, elliptic-curves, browser-demo, educational, TypeScript, Vite

## References

- Jao, De Feo: "Towards quantum-resistant cryptosystems from supersingular elliptic curve isogenies" (2011)
- Castryck, Decru: "An efficient key recovery attack on SIDH" (ePrint 2022/975, August 5, 2022)
- Maino, Martindale, Robert confirmations (September 2022)
- NIST PQC Standardization: https://csrc.nist.gov/projects/post-quantum-cryptography/
- SQIsign v2.0 (2025): Upcoming NIST Round 2 additional signature candidate

---

**"Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God." — 1 Corinthians 10:31**
