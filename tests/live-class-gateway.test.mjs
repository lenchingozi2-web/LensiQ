import test from 'node:test';
import assert from 'node:assert/strict';
import { issueLiveClassGatewayToken, verifyLiveClassGatewayToken } from '../lib/voice/live-class-gateway-auth.ts';

const secret = 'local-development-test-key-that-is-not-a-real-secret';
const sessionId = 'fdb38076-4ccb-4cb5-8810-8eae9725f490';
const userId = '8109ba6c-d82e-4397-8d71-bb4062065418';
const roomName = 'lensiq-voice-12345678-abcdefab-1234-4123-8123-abcdef123456';

test('gateway token is scoped to one classroom and has a hard deadline', () => {
  const token = issueLiveClassGatewayToken(secret, {
    roomName, sessionId, userId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const claims = verifyLiveClassGatewayToken(secret, 'Bearer ' + token);
  assert.equal(claims?.session, sessionId);
  assert.equal(claims?.room, roomName);
  assert.equal(claims?.user, userId);
});

test('wrong signing key, tampered token and missing authorization are rejected', () => {
  const token = issueLiveClassGatewayToken(secret, {
    roomName, sessionId, userId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(verifyLiveClassGatewayToken('wrong-key', 'Bearer ' + token), null);
  assert.equal(verifyLiveClassGatewayToken(secret, 'Bearer ' + token + 'a'), null);
  assert.equal(verifyLiveClassGatewayToken(secret, null), null);
});

test('expired and excessively long permissions cannot be issued', () => {
  const details = { roomName, sessionId, userId };
  assert.throws(() => issueLiveClassGatewayToken(secret, {
    ...details, expiresAt: new Date(Date.now() - 2000).toISOString(),
  }));
  assert.throws(() => issueLiveClassGatewayToken(secret, {
    ...details, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  }));
});
