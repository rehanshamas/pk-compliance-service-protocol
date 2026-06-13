#!/usr/bin/env python3
"""Generate RSA key pair for JWT RS256 signing.

Run from the backend directory:
    python scripts/generate_jwt_keys.py

Creates jwt_private.pem and jwt_public.pem in the current working directory.
"""

import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def main() -> None:
    private_key_path = Path("jwt_private.pem")
    public_key_path = Path("jwt_public.pem")

    for p in (private_key_path, public_key_path):
        if p.exists():
            print(f"ERROR: {p} already exists. Remove it first if you want to regenerate.")
            sys.exit(1)

    # Generate 2048-bit RSA key pair
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Serialize private key (PKCS8, PEM, no encryption)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Serialize public key
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    private_key_path.write_bytes(private_pem)
    public_key_path.write_bytes(public_pem)

    # Restrict private key permissions (owner read-only)
    private_key_path.chmod(0o600)
    public_key_path.chmod(0o644)

    print(f"Generated {private_key_path} and {public_key_path}")
    print()
    print("Set the following environment variables (or add to .env):")
    print(f"  JWT_PRIVATE_KEY_PATH={private_key_path}")
    print(f"  JWT_PUBLIC_KEY_PATH={public_key_path}")
    print("  JWT_ALGORITHM=RS256")


if __name__ == "__main__":
    main()
