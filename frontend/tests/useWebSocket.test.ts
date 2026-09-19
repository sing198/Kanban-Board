// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from '../src/useWebSocket';

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: null | (() => Promise<void>) = null;
  onclose: null | (() => void) = null;
  onmessage: null | ((event: { data: string }) => void) = null;
  onerror = null;
  send = vi.fn();
  constructor(_url: string) { FakeSocket.instances.push(this); }
  close() { this.readyState = 3; this.onclose?.(); }
  async open() { this.readyState = 1; await this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

const card = { ID: 1, BoardID: 'board', Title: 'Example', List: 'TODO', Position: 1000 };
let savedBoard: Record<string, unknown>;
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  sessionStorage.clear(); localStorage.clear();
  savedBoard = { Name: 'Demo', Cards: [card], Columns: 'TODO,DOING,DONE' };
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => savedBoard })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function connected() {
  const hook = renderHook(() => useWebSocket('board', null));
  const socket = FakeSocket.instances[0];
  await act(async () => { await socket.open(); });
  return { ...hook, socket };
}

describe('board connection recovery', () => {
  it('blocks edits before the initial board refresh finishes', async () => {
    const { result } = renderHook(() => useWebSocket('board', null));
    act(() => result.current.addCard('New', 'TODO'));
    expect(FakeSocket.instances[0].send).not.toHaveBeenCalled();
    expect(result.current.errorToast).toContain('Change not sent');
  });

  it('does not move or delete cards, rename the board or add columns while offline', async () => {
    const { result, socket } = await connected();
    act(() => socket.close());
    act(() => {
      result.current.moveCard('1', 'DOING', 2000);
      result.current.deleteCard('1');
      result.current.updateBoardName('Not saved');
      result.current.addColumn('Review');
    });
    expect(result.current.cards).toEqual([card]);
    expect(result.current.boardName).toBe('Demo');
    expect(result.current.columns).toEqual(['TODO', 'DOING', 'DONE']);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('does not apply an optimistic move when send throws', async () => {
    const { result, socket } = await connected();
    socket.send.mockImplementation(() => { throw new Error('closed'); });
    act(() => result.current.moveCard('1', 'DONE', 2000));
    expect(result.current.cards[0].List).toBe('TODO');
    expect(result.current.status).toBe('disconnected');
  });

  it('reloads authoritative data on reconnect', async () => {
    const { result, socket } = await connected();
    act(() => result.current.moveCard('1', 'DOING', 2000));
    expect(result.current.cards[0].List).toBe('DOING');
    act(() => socket.close());
    savedBoard = { ...savedBoard, Cards: [{ ...card, List: 'DONE' }] };
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await FakeSocket.instances[1].open(); });
    expect(result.current.cards[0].List).toBe('DONE');
    expect(result.current.status).toBe('connected');
  });

  it('reverts optimistic data after server rejection', async () => {
    const { result, socket } = await connected();
    act(() => result.current.moveCard('1', 'DONE', 2000));
    await act(async () => { socket.message({ type: 'ERROR', title: 'View only' }); });
    expect(result.current.cards[0].List).toBe('TODO');
    expect(result.current.errorToast).toBe('View only');
  });

  it('sends a detail edit once and updates another client from the echoed event', async () => {
    const { result, socket } = await connected();
    act(() => result.current.editCardDetail('1', { title: 'Updated', swimlane: 'Engineering' }));
    expect(socket.send).toHaveBeenCalledTimes(1);
    act(() => socket.message({ type: 'EDIT_CARD', cardId: '1', title: 'Remote', swimlane: 'Product' }));
    expect(result.current.cards[0].Title).toBe('Remote');
    expect(result.current.cards[0].Swimlane).toBe('Product');
  });
});
