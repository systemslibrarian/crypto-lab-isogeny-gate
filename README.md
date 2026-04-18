# crypto-lab-isogeny-gate

## What It Is

Elliptic curve isogenies are group homomorphisms between elliptic curves that preserve the group structure. This demo explores isogenies as they appeared in the post-quantum cryptography world: the elegant theory behind SIDH (Supersingular Isogeny Diffie-Hellman), their decade-long promise as a post-quantum KEM candidate, the mathematical machinery that broke them (the Castryck-Decru attack, August 2022), and the modern survivors (SQIsign, CSIDH) that remain under active research. The security model is asymmetric (public-key cryptography); the problem is hardness of computing isogeny paths in supersingular expander graphs.

## When to Use It

- **For teaching post-quantum cryptography**: Isogenies represent a different mathematical foundation than lattices or hash-based schemes. Use this demo to show why NIST's multi-family approach matters.
  
- **For understanding structure-breaking attacks**: The Castryck-Decru attack is not a parameter-tuning failure—it exploits auxiliary information (torsion point images) that seemed safe for a decade.

- **For learning how beautiful math fails in practice**: Isogenies are among the most elegant post-quantum candidates. This demo shows that elegance and years of scrutiny do not guarantee security.

- **When NOT to use it**: Do not use SIDH, SIKE, or isogeny-based key exchange for production. Use ML-KEM (NIST FIPS 203) instead. Do not assume SQIsign is production-ready (it is NIST Round 2 only, not standardized, still under cryptanalysis).

## Live Demo

**[https://systemslibrarian.github.io/crypto-lab-isogeny-gate/](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/)**

The demo runs five interactive exhibits in your browser:
1. **What Is an Isogeny?** — Visual definition and example computation.
2. **The Isogeny Graph** — Expander graph of supersingular elliptic curves with random walk simulation.
3. **SIDH Key Exchange** — Protocol demonstration; both parties compute the same shared secret.
4. **The Castryck-Decru Attack** — Brute-force recovery of Alice's secret from published torsion point images.
5. **Lessons for PQC Design** — Five principles derived from the SIDH break.

All exhibits use toy parameters (p=71 for visibility) but apply exact BigInt arithmetic—results are cryptographically valid for small primes.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-isogeny-gate
cd crypto-lab-isogeny-gate
npm install
npm run dev
```

Then open `http://localhost:5173/` in your browser. To build for production: `npm run build`.

## Part of the Crypto-Lab Suite

One of 60+ live browser demos at [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/) — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
