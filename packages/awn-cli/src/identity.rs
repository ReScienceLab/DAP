use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::crypto::agent_id_from_public_key;

#[derive(Clone)]
pub struct Identity {
    pub agent_id: String,
    pub pub_b64: String,
    pub signing_key: SigningKey,
}

#[derive(Serialize, Deserialize)]
struct IdentityFile {
    seed: String,
    #[serde(rename = "publicKey")]
    public_key: String,
}

/// Load an existing Ed25519 identity from `data_dir` or create a new one.
/// File name defaults to `identity.json` but can be overridden with `name`.
/// Wire-compatible with the TS `loadOrCreateIdentity()`.
pub fn load_or_create_identity(data_dir: &Path, name: &str) -> Result<Identity, IdentityError> {
    fs::create_dir_all(data_dir).map_err(IdentityError::Io)?;
    let id_file = data_dir.join(format!("{name}.json"));

    let signing_key = if id_file.exists() {
        let raw = fs::read_to_string(&id_file).map_err(IdentityError::Io)?;
        let saved: IdentityFile =
            serde_json::from_str(&raw).map_err(|e| IdentityError::Parse(e.to_string()))?;
        let seed_bytes = B64.decode(&saved.seed).map_err(|_| {
            IdentityError::Parse("invalid base64 seed in identity file".into())
        })?;
        let seed: [u8; 32] = seed_bytes.try_into().map_err(|_| {
            IdentityError::Parse("seed must be exactly 32 bytes".into())
        })?;
        SigningKey::from_bytes(&seed)
    } else {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let seed = signing_key.to_bytes();
        let pub_b64 = B64.encode(signing_key.verifying_key().as_bytes());
        let id_data = IdentityFile {
            seed: B64.encode(seed),
            public_key: pub_b64,
        };
        let json = serde_json::to_string_pretty(&id_data).unwrap();
        fs::write(&id_file, json).map_err(IdentityError::Io)?;
        signing_key
    };

    let pub_b64 = B64.encode(signing_key.verifying_key().as_bytes());
    let agent_id = agent_id_from_public_key(&pub_b64)
        .map_err(|e| IdentityError::Parse(e.to_string()))?;

    Ok(Identity {
        agent_id,
        pub_b64,
        signing_key,
    })
}

#[derive(Debug, thiserror::Error)]
pub enum IdentityError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_create_new_identity() {
        let tmp = TempDir::new().unwrap();
        let id = load_or_create_identity(tmp.path(), "identity").unwrap();
        assert!(id.agent_id.starts_with("aw:sha256:"));
        assert!(!id.pub_b64.is_empty());
        assert!(tmp.path().join("identity.json").exists());
    }

    #[test]
    fn test_load_existing_identity() {
        let tmp = TempDir::new().unwrap();
        let id1 = load_or_create_identity(tmp.path(), "identity").unwrap();
        let id2 = load_or_create_identity(tmp.path(), "identity").unwrap();
        assert_eq!(id1.agent_id, id2.agent_id);
        assert_eq!(id1.pub_b64, id2.pub_b64);
    }

    #[test]
    fn test_different_names_different_identities() {
        let tmp = TempDir::new().unwrap();
        let id1 = load_or_create_identity(tmp.path(), "alice").unwrap();
        let id2 = load_or_create_identity(tmp.path(), "bob").unwrap();
        assert_ne!(id1.agent_id, id2.agent_id);
        assert!(tmp.path().join("alice.json").exists());
        assert!(tmp.path().join("bob.json").exists());
    }

    #[test]
    fn test_identity_file_format_compatible_with_ts() {
        let tmp = TempDir::new().unwrap();
        let _id = load_or_create_identity(tmp.path(), "identity").unwrap();
        let raw = fs::read_to_string(tmp.path().join("identity.json")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert!(parsed.get("seed").is_some(), "must have 'seed' field");
        assert!(
            parsed.get("publicKey").is_some(),
            "must have 'publicKey' field (camelCase like TS)"
        );
    }

    #[test]
    fn test_load_ts_generated_identity() {
        // Simulate a TS-generated identity.json
        let tmp = TempDir::new().unwrap();
        let seed: [u8; 32] = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
            24, 25, 26, 27, 28, 29, 30, 31, 32,
        ];
        let signing_key = SigningKey::from_bytes(&seed);
        let pub_b64 = B64.encode(signing_key.verifying_key().as_bytes());
        let ts_json = serde_json::json!({
            "seed": B64.encode(seed),
            "publicKey": pub_b64
        });
        fs::write(
            tmp.path().join("identity.json"),
            serde_json::to_string_pretty(&ts_json).unwrap(),
        )
        .unwrap();

        let id = load_or_create_identity(tmp.path(), "identity").unwrap();
        assert_eq!(id.pub_b64, "ebVWLo/mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ=");
        assert_eq!(
            id.agent_id,
            "aw:sha256:65b60673d6ed884bf01c2c222d82ada0740f29ac3355d6a925c81f17f47a27b8"
        );
    }

    #[test]
    fn test_creates_data_dir_if_missing() {
        let tmp = TempDir::new().unwrap();
        let nested = tmp.path().join("deep").join("nested").join("dir");
        let id = load_or_create_identity(&nested, "identity").unwrap();
        assert!(id.agent_id.starts_with("aw:sha256:"));
        assert!(nested.join("identity.json").exists());
    }

    #[test]
    fn test_corrupt_identity_file_returns_error() {
        let tmp = TempDir::new().unwrap();
        fs::write(tmp.path().join("identity.json"), "not valid json").unwrap();
        let result = load_or_create_identity(tmp.path(), "identity");
        assert!(result.is_err());
    }
}
