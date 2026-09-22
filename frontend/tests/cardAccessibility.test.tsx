// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CardDetailModal } from '../src/pages/Board';
afterEach(cleanup);
it('moves a task using labeled native controls and restores focus on close', () => {
 const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
 const onMove = vi.fn(), onClose = vi.fn();
 const view = render(<CardDetailModal card={{ ID: 1, Title: 'Test', List: 'TODO' }} canEdit theme="light" columns={['TODO','DONE']} swimlanes={['Product']} onClose={onClose} onMove={onMove} onEditDetail={vi.fn()} onDeleteCard={vi.fn()} />);
 expect(document.activeElement).toBe(screen.getByLabelText('Task title'));
 fireEvent.change(screen.getByLabelText('Move task to column'), { target: { value: 'DONE' } });
 expect(onMove).toHaveBeenCalledWith('1', 'DONE');
 fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
 expect(onClose).toHaveBeenCalled();
 view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
});
it('keeps view-only users from moving tasks', () => {
 render(<CardDetailModal card={{ ID: 1, Title: 'Test', List: 'TODO' }} canEdit={false} theme="light" columns={['TODO','DONE']} swimlanes={['Product']} onClose={vi.fn()} onMove={vi.fn()} onEditDetail={vi.fn()} onDeleteCard={vi.fn()} />);
 expect((screen.getByLabelText('Move task to column') as HTMLSelectElement).disabled).toBe(true);
 expect((screen.getByLabelText('Move task to swimlane') as HTMLSelectElement).disabled).toBe(true);
});
