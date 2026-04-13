import jwt from 'jsonwebtoken';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET doit être défini dans .env (minimum 32 caractères recommandé)'
    );
  }
  return secret;
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getSecret());
}
