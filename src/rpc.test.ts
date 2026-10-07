import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOST_REFUSAL_REASONS,
  HOST_REFUSAL_REASON_TO_RPC_CODE,
  RPC_ERROR_CODES,
  hostRefusalCode,
  isRpcErrorCode,
  type RpcErrorCode,
  type RpcResponseErr,
  type ScopeCheckUnavailableData,
} from './rpc.js';

test('RPC_ERROR_CODES keeps every pre-existing code (backward compatible)', () => {
  for (const c of [
    'method_not_found',
    'invalid_params',
    'scope_denied',
    'pkg_not_authenticated',
    'shell_unavailable',
    'internal_error',
  ]) {
    assert.ok(isRpcErrorCode(c), c);
  }
});

test('scope_check_unavailable is a known code, and codes are unique', () => {
  assert.ok(isRpcErrorCode('scope_check_unavailable'));
  assert.equal(new Set(RPC_ERROR_CODES).size, RPC_ERROR_CODES.length);
});

test('isRpcErrorCode rejects unknown values', () => {
  assert.equal(isRpcErrorCode('check-unavailable'), false);
  assert.equal(isRpcErrorCode(undefined), false);
  assert.equal(isRpcErrorCode(42), false);
});

test('a scope_check_unavailable envelope type-checks with its data shape', () => {
  const data: ScopeCheckUnavailableData = { scope: 'tasks:read', detail: 'kernel offline', retryable: true };
  const res: RpcResponseErr = {
    v: 1,
    id: 'r1',
    error: { code: 'scope_check_unavailable', message: "couldn't check", data },
  };
  assert.equal(res.error.code, 'scope_check_unavailable');
});

test('every host refusal reason maps to a valid RpcErrorCode', () => {
  for (const r of HOST_REFUSAL_REASONS) {
    assert.ok(isRpcErrorCode(HOST_REFUSAL_REASON_TO_RPC_CODE[r]), r);
  }
});

test('hostRefusalCode: check-unavailable maps to scope_check_unavailable', () => {
  const sc = {
    ok: false,
    error: "host.dbQuery: couldn't check the pkg's declared capabilities (x). This is not a denial; try again",
    reason: 'check-unavailable',
  };
  assert.equal(hostRefusalCode(sc), 'scope_check_unavailable');
});

test('hostRefusalCode: scope-denied with reason only (host.notify shape) maps to scope_denied', () => {
  assert.equal(hostRefusalCode({ ok: false, reason: 'scope-denied' }), 'scope_denied');
});

test('hostRefusalCode: legacy refusal without reason, unknown reason, success, junk give null', () => {
  const cases: unknown[] = [
    { ok: false, error: "host.dbQuery: pkg lacks the 'sqlite' capability" },
    { ok: false, error: 'x', reason: 'something-new' },
    { ok: false, reason: 'toString' },
    { ok: true, reason: 'check-unavailable' },
    null,
    'check-unavailable',
    undefined,
  ];
  for (const c of cases) assert.equal(hostRefusalCode(c), null, JSON.stringify(c));
});

test('RpcErrorCode switch is exhaustive over RPC_ERROR_CODES', () => {
  const label = (c: RpcErrorCode): string => {
    switch (c) {
      case 'method_not_found':
      case 'invalid_params':
      case 'scope_denied':
      case 'scope_check_unavailable':
      case 'pkg_not_authenticated':
      case 'shell_unavailable':
      case 'internal_error':
        return c;
      default: {
        const never: never = c;
        return never;
      }
    }
  };
  for (const c of RPC_ERROR_CODES) assert.equal(label(c), c);
});
