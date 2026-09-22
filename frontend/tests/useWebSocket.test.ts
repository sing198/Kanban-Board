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
  await act(async () => {});
  const socket = FakeSocket.instances[0];
  await act(async () => { await socket.open(); });
  return { ...hook, socket };
}

describe('board connection recovery', () => {
  it('blocks edits before the initial board refresh finishes', async () => {
    const { result } = renderHook(() => useWebSocket('board', null));
    act(() => result.current.addCard('New', 'TODO'));
    expect(FakeSocket.instances.every(socket => socket.send.mock.calls.length === 0)).toBe(true);
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

describe('mutation feedback and undo', () => {
  it('does not announce saved until the matching server confirmation arrives', async () => {
    const { result, socket } = await connected();
    act(() => result.current.addCard('New', 'TODO'));
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(result.current.operations[0].state).toBe('saving');
    act(() => socket.message({ type: 'ADD_CARD', requestId: 'another-client', card: { ...card, ID: 2 } }));
    expect(result.current.operations[0].state).toBe('saving');
    act(() => socket.message({ type: 'ADD_CARD', requestId: sent.requestId, card: { ...card, ID: 3 } }));
    expect(result.current.operations[0].state).toBe('saved');
  });

  it('retains rejected edits for explicit retry', async () => {
    const { result, socket } = await connected();
    act(() => result.current.editCard('1', 'Changed'));
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    await act(async () => socket.message({ type: 'ERROR', requestId: sent.requestId, title: 'Try again' }));
    expect(result.current.operations[0].state).toBe('error');
    expect(result.current.cards[0].Title).toBe('Example');
    act(() => result.current.retryOperation(sent.requestId));
    expect(JSON.parse(socket.send.mock.calls[1][0]).changes.title).toBe('Changed');
  });

  it('does not replay an uncertain create after timeout', async () => {
    const { result, socket } = await connected();
    act(() => result.current.addCard('New', 'TODO'));
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(result.current.operations[0].state).toBe('unknown');
    act(() => result.current.retryOperation(result.current.operations[0].id));
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it('undo restores the complete task without sending a delete', async () => {
    const { result, socket } = await connected();
    act(() => result.current.deleteCard('1'));
    expect(result.current.cards).toEqual([]);
    act(() => result.current.undoDelete('1'));
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(result.current.cards).toEqual([card]);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('sends deletion only after the undo window and waits for confirmation', async () => {
    const { result, socket } = await connected();
    act(() => result.current.deleteCard('1'));
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent.type).toBe('DELETE_CARD');
    expect(result.current.operations[0].state).toBe('saving');
    act(() => socket.message(sent));
    expect(result.current.cards).toEqual([]);
    expect(result.current.operations[0].state).toBe('saved');
  });

  it('cancels a scheduled deletion when leaving the board', async () => {
    const { result, socket, unmount } = await connected();
    act(() => result.current.deleteCard('1'));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(socket.send).not.toHaveBeenCalled();
  });
});

it('updates live avatars on presence messages and clears stale users on disconnect', async () => {
 const { result, socket } = await connected();
 act(() => socket.message({type:'PRESENCE', boardId:'board', users:[{id:1,name:'Alice',avatarUrl:''},{id:2,name:'Bob',avatarUrl:''}]}));
 expect(result.current.onlineUsers.map(user => user.name)).toEqual(['Alice','Bob']);
 act(() => socket.message({type:'PRESENCE', boardId:'another-board', users:[]}));
 expect(result.current.onlineUsers).toHaveLength(2);
 act(() => socket.message({type:'PRESENCE', boardId:'board', users:[{id:1,name:'Alice',avatarUrl:''}]}));
 expect(result.current.onlineUsers).toHaveLength(1);
 act(() => socket.close());
 expect(result.current.onlineUsers).toEqual([]);
});

for (const code of [403,404]) it(`stops reconnecting on HTTP ${code}`, async () => {
 vi.stubGlobal('fetch', vi.fn(async()=>({ok:false,status:code})));
 const {result} = renderHook(()=>useWebSocket('board',null));
 await act(async()=>{});
 expect(result.current.boardError).toBe(code===404?'missing':'forbidden');
 await act(async()=>vi.advanceTimersByTimeAsync(30000));
 expect(FakeSocket.instances).toHaveLength(0);
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('sends only changed fields and preserves unrelated remote edits',async()=>{
 const {result,socket}=await connected();
 act(()=>result.current.editCardDetail('1',{description:'Mine'}));
 const payload=JSON.parse(socket.send.mock.calls[0][0]);
 expect(payload.changes).toEqual({description:'Mine'});
 expect(payload.expected).toEqual({description:''});
 act(()=>socket.message({type:'EDIT_CARD',cardId:'1',changes:{title:'Remote'}}));
 expect(result.current.cards[0].Title).toBe('Remote');
 expect(result.current.cards[0].Description).toBe('Mine');
 act(()=>socket.message({type:'EDIT_CARD',cardId:'1',changes:{description:''}}));
 expect(result.current.cards[0].Description).toBe('');
});
