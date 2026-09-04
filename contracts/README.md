# PlotProof contracts

This Foundry project contains the `Farmer` contract used by PlotProof. It is deployed on Ethereum Sepolia; see [INTERFACE_SPEC.md](INTERFACE_SPEC.md) for the deployed address, transaction, ABI, and frontend encoding rules.

## Commands

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

The root GitHub Actions workflow runs these commands with `contracts/` as its working directory. The local machine needs Foundry installed to run them manually.
