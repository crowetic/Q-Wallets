import { describe, it, expect } from 'vitest';
import {
  validateBtcAddress,
  validateDgbAddress,
  validateDogeAddress,
  validateLtcAddress,
  validateQortAddress,
  validateRvnAddress,
} from '../addressValidation';

describe('addressValidation', () => {
  describe('validateLtcAddress', () => {
    describe('valid addresses', () => {
      it('should accept P2PKH addresses starting with L', () => {
        expect(validateLtcAddress('LXjfhJaYMBRtqCCNFdUmYzxvvGTgPQAmZM')).toBe(
          true
        );
        expect(validateLtcAddress('LcHK4Z4kTbTyEAasFd2mYNe7hfFaRP1Qpf')).toBe(
          true
        );
        expect(validateLtcAddress('LcBu5nWpGyL5FzXR4Urtmqk5unHhEEKPbx')).toBe(
          true
        );
        expect(validateLtcAddress('LN8hQaoX9fESwL58Zfi6fWannJ2rHyHVVQ')).toBe(
          true
        );
      });

      it('should accept P2SH addresses starting with M', () => {
        expect(validateLtcAddress('MJKuCRJmLjFSwvsrkPPcTGSxqPQgmwRNkR')).toBe(
          true
        );
        expect(validateLtcAddress('MAVWzxXm8KGhJRfNqwx9JvBPpvSTUaJPfk')).toBe(
          true
        );
        expect(validateLtcAddress('MEV94kafEdkZn222q6TLnZzwt3GGz6w2J5')).toBe(
          true
        );
        expect(validateLtcAddress('MQW3uugVsdBLj48xuV2ygqF15RcYshFfKs')).toBe(
          true
        );
      });

      it('should accept Bech32 P2WPKH addresses (ltc1q...)', () => {
        // Standard 43-character P2WPKH address
        expect(
          validateLtcAddress('ltc1q9kk0zvwglnw6twj7xj2j5qt94afc42l5pm7aj9')
        ).toBe(true);
        expect(
          validateLtcAddress('ltc1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z0tamvsu')
        ).toBe(true);
        expect(
          validateLtcAddress('ltc1quex4vj4w8wj7alxa9eh0fxcep4cqlwhegaqd2t')
        ).toBe(true);
      });

      it('should accept Bech32 P2WSH addresses (ltc1q... longer)', () => {
        // 62-character P2WSH address
        expect(
          validateLtcAddress('ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kgmn4n9')
        ).toBe(true);
      });

      it('should accept Bech32 Taproot addresses (ltc1p...)', () => {
        // P2TR (Taproot) addresses start with ltc1p and are 62 characters
        expect(
          validateLtcAddress(
            'ltc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqdmchcc'
          )
        ).toBe(true);
      });

      it('should accept addresses with leading/trailing whitespace', () => {
        expect(
          validateLtcAddress('  ltc1q9kk0zvwglnw6twj7xj2j5qt94afc42l5pm7aj9  ')
        ).toBe(true);
        expect(
          validateLtcAddress('\tLXjfhJaYMBRtqCCNFdUmYzxvvGTgPQAmZM\n')
        ).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateLtcAddress('')).toBe(false);
        expect(validateLtcAddress('   ')).toBe(false);
      });

      it('should reject addresses with invalid prefixes', () => {
        expect(validateLtcAddress('1XjfhJaYMBRtqCCNFdUmYzxvvGTgPQAmZM')).toBe(
          false
        ); // BTC-style
        expect(validateLtcAddress('3JKuCRJmLjFSwvsrkPPcTGSxqPQgmwRNkR')).toBe(
          false
        ); // BTC-style
        expect(
          validateLtcAddress('bc1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z0wluxhr')
        ).toBe(false); // BTC Bech32
      });

      it('should reject Bech32 addresses with invalid characters (1, b, i, o)', () => {
        // These contain invalid Bech32 characters
        expect(
          validateLtcAddress('ltc1q770u3ctquh2yee7uc3at9mvjnl04cf6myj2l91')
        ).toBe(false); // contains '1'
        expect(
          validateLtcAddress('ltc1q770u3ctquh2yee7uc3at9mvjnl04cf6myj2l9b')
        ).toBe(false); // contains 'b'
        expect(
          validateLtcAddress('ltc1q770u3ctquh2yee7uc3at9mvjnl04cf6myj2l9i')
        ).toBe(false); // contains 'i'
        expect(
          validateLtcAddress('ltc1q770u3ctquh2yee7uc3at9mvjnl04cf6myj2l9o')
        ).toBe(false); // contains 'o'
      });

      it('should reject addresses that are too short', () => {
        expect(
          validateLtcAddress('ltc1q770u3ctquh2yee7uc3at9mvjnl04cf6m')
        ).toBe(false);
        expect(validateLtcAddress('LXjfhJaYMBRtqCCNFdUm')).toBe(false);
      });

      it('should reject addresses that are too long', () => {
        expect(
          validateLtcAddress('LXjfhJaYMBRtqCCNFdUmYzxvvGTgPQAmZMextra')
        ).toBe(false);
      });

      it('should reject addresses with uppercase in Bech32 part', () => {
        expect(
          validateLtcAddress('ltc1Q9kk0zvwglnw6twj7xj2j5qt94afc42l5pm7aj9')
        ).toBe(false);
      });

      it('should reject random strings', () => {
        expect(validateLtcAddress('notanaddress')).toBe(false);
        expect(validateLtcAddress('12345678901234567890123456789012345')).toBe(
          false
        );
      });
    });
  });

  describe('validateBtcAddress', () => {
    describe('valid addresses', () => {
      it('should accept P2PKH addresses starting with 1', () => {
        expect(validateBtcAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(
          true
        );
      });

      it('should accept P2SH addresses starting with 3', () => {
        expect(validateBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(
          true
        );
      });

      it('should accept Bech32 P2WPKH addresses (bc1q...)', () => {
        expect(
          validateBtcAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
        ).toBe(true);
      });

      it('should accept Bech32 addresses containing 0 and l (valid Bech32 charset)', () => {
        // '0' and 'l' are valid Bech32 characters and must not be rejected
        expect(
          validateBtcAddress('bc1q9kk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(true);
      });

      it('should accept Bech32 P2WSH addresses (bc1q... longer)', () => {
        expect(
          validateBtcAddress(
            'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3'
          )
        ).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateBtcAddress('')).toBe(false);
        expect(validateBtcAddress('   ')).toBe(false);
      });

      it('should reject Bech32 addresses with invalid characters (1, b, i, o)', () => {
        expect(
          validateBtcAddress('bc1q9kk1zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // '1'
        expect(
          validateBtcAddress('bc1qbkk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // 'b'
        expect(
          validateBtcAddress('bc1qikk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // 'i'
        expect(
          validateBtcAddress('bc1qokk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // 'o'
      });

      it('should reject addresses with uppercase in Bech32 part', () => {
        expect(
          validateBtcAddress('bc1Qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
        ).toBe(false);
      });

      it('should reject LTC Bech32 addresses', () => {
        expect(
          validateBtcAddress('ltc1q9kk0zvwglnw6twj7xj2j5qt94afc42l5pm7aj9')
        ).toBe(false);
      });
    });
  });

  describe('validateDgbAddress', () => {
    describe('valid addresses', () => {
      it('should accept P2PKH addresses starting with D', () => {
        expect(validateDgbAddress('DMguqG5busEUvCg85sQBxUqUBmE7huM6xy')).toBe(
          true
        );
      });

      it('should accept P2SH addresses starting with S', () => {
        expect(validateDgbAddress('SUngTA1vaC2E62mbnc81Mdos3TcKXMHkcy')).toBe(
          true
        );
      });

      it('should accept Bech32 P2WPKH addresses (dgb1q...)', () => {
        expect(
          validateDgbAddress('dgb1qar0srrr7xfkvy5l643lydnw9re59gtzz9zw2cf')
        ).toBe(true);
      });

      it('should accept Bech32 addresses containing 0 and l (regression)', () => {
        // Regression: '0' was previously excluded from the dgb1 charset, rejecting valid addresses
        expect(
          validateDgbAddress('dgb1q9kk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateDgbAddress('')).toBe(false);
        expect(validateDgbAddress('   ')).toBe(false);
      });

      it('should reject Bech32 addresses with invalid characters (1, b, i, o)', () => {
        expect(
          validateDgbAddress('dgb1q9kk1zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // '1'
        expect(
          validateDgbAddress('dgb1qbkk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // 'b'
        expect(
          validateDgbAddress('dgb1qokk0zvwglnw6twj7xj2j5qt94afc42l5h6kdsm')
        ).toBe(false); // 'o'
      });

      it('should reject addresses with uppercase in Bech32 part', () => {
        expect(
          validateDgbAddress('dgb1Qar0srrr7xfkvy5l643lydnw9re59gtzz9zw2cf')
        ).toBe(false);
      });
    });
  });

  describe('validateDogeAddress', () => {
    describe('valid addresses', () => {
      it('should accept P2PKH addresses starting with D', () => {
        expect(validateDogeAddress('DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L')).toBe(
          true
        );
        expect(validateDogeAddress('DBXu2kgc3xtvCUWFcxFE3r9hEYgmuaaCyD')).toBe(
          true
        );
      });

      it('should accept addresses with leading/trailing whitespace', () => {
        expect(
          validateDogeAddress('  DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L  ')
        ).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateDogeAddress('')).toBe(false);
        expect(validateDogeAddress('   ')).toBe(false);
      });

      it('should reject addresses with an invalid prefix', () => {
        expect(validateDogeAddress('AH5yaieqoZN36fDVciNyRueRGvGLR3mr7L')).toBe(
          false
        );
        expect(validateDogeAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enQ8')).toBe(
          false
        ); // RVN
      });

      it('should reject base58-ambiguous characters (0, O, I, l)', () => {
        expect(validateDogeAddress('DH5yaieqoZN36fDVciNyRueRGvGLR3mr0L')).toBe(
          false
        ); // '0'
        expect(validateDogeAddress('DH5yaieqoZN36fDVciNyRueRGvGLR3mrlL')).toBe(
          false
        ); // 'l'
      });

      it('should reject addresses that are too short or too long', () => {
        expect(validateDogeAddress('DH5yaieqoZN36fDVciNyRueRGvGLR3mr')).toBe(
          false
        );
        expect(
          validateDogeAddress('DH5yaieqoZN36fDVciNyRueRGvGLR3mr7Lextra')
        ).toBe(false);
      });
    });
  });

  describe('validateRvnAddress', () => {
    describe('valid addresses', () => {
      it('should accept P2PKH addresses starting with R', () => {
        expect(validateRvnAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enQ8')).toBe(
          true
        );
      });

      it('should accept addresses with leading/trailing whitespace', () => {
        expect(
          validateRvnAddress('\tRXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enQ8\n')
        ).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateRvnAddress('')).toBe(false);
        expect(validateRvnAddress('   ')).toBe(false);
      });

      it('should reject addresses with an invalid prefix', () => {
        expect(validateRvnAddress('DXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enQ8')).toBe(
          false
        ); // DOGE/DGB
      });

      it('should reject base58-ambiguous characters (0, O, I, l)', () => {
        expect(validateRvnAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87en0Q')).toBe(
          false
        ); // '0'
        expect(validateRvnAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enlQ')).toBe(
          false
        ); // 'l'
      });

      it('should reject addresses that are too short or too long', () => {
        expect(validateRvnAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87en')).toBe(
          false
        );
        expect(
          validateRvnAddress('RXissCG2jZTNd6Mp8x3Jpvw8Gqgj87enQ8extra')
        ).toBe(false);
      });
    });
  });

  describe('validateQortAddress', () => {
    describe('valid addresses', () => {
      it('should accept base58 addresses', () => {
        expect(validateQortAddress('QgV4s3xnzLhVBEJxcYui4u4q11yhUHsd9v')).toBe(
          true
        );
      });

      it('should accept names (minimum 3 characters)', () => {
        expect(validateQortAddress('Bob')).toBe(true);
        expect(validateQortAddress('alice')).toBe(true);
      });

      it('should accept addresses with leading/trailing whitespace', () => {
        expect(validateQortAddress('  Bob  ')).toBe(true);
      });
    });

    describe('invalid addresses', () => {
      it('should reject empty strings', () => {
        expect(validateQortAddress('')).toBe(false);
        expect(validateQortAddress('   ')).toBe(false);
      });

      it('should reject values shorter than 3 characters', () => {
        expect(validateQortAddress('ab')).toBe(false);
        expect(validateQortAddress(' a ')).toBe(false);
      });
    });
  });
});
