import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfirmationRequest } from '../src/confirmation-request.ts';

const options = {
  kicker: 'UNSAVED DRAFT',
  title: 'Replace this draft?',
  description: 'Continuing will discard your current changes.',
  recordName: 'Project plan',
  recordMeta: 'Toolbox · Unsaved changes',
  confirmLabel: 'Discard & continue',
  cancelLabel: 'Keep editing',
};

/** Keep the test state separate from confirmation results, as it is in the editor. */
function setup() {
  let snapshot = { draft: 'Original work' };
  const changes = [];
  const controller = createConfirmationRequest({
    getSnapshot() {
      return snapshot;
    },
    onChange(value) {
      changes.push(value);
    },
  });
  return {
    controller,
    changes,
    replaceSnapshot() {
      snapshot = { draft: 'New work' };
    },
  };
}

test('accepts the current request only after clearing its visible dialog', async function acceptsCurrent() {
  const { controller, changes } = setup();
  const answer = controller.ask(options);
  assert.deepEqual(changes, [options]);
  controller.resolve(true);
  assert.deepEqual(changes, [options, null]);
  assert.equal(await answer, true);
  controller.resolve(true);
  assert.equal(changes.length, 2, 'a repeated result must not notify the view again');
});

test('declining and canceling never authorize the waiting action', async function declinesAction() {
  const { controller, changes } = setup();
  const declined = controller.ask(options);
  controller.resolve(false);
  assert.equal(await declined, false);
  const canceled = controller.ask(options);
  controller.cancel();
  assert.equal(await canceled, false);
  assert.deepEqual(changes, [options, null, options, null]);
});

test('rejects approval if the editor changed while the dialog was open', async function rejectsChangedSnapshot() {
  const { controller, replaceSnapshot } = setup();
  const answer = controller.ask(options);
  replaceSnapshot();
  controller.resolve(true);
  assert.equal(await answer, false);
});

test('rejects approval when state changes before the awaiting action resumes', async function rejectsResumedSnapshot() {
  const { controller, replaceSnapshot } = setup();
  const answer = controller.ask(options);
  controller.resolve(true);
  replaceSnapshot();
  assert.equal(await answer, false);
});

test('overlapping requests cannot replace or approve the first action', async function preservesPendingRequest() {
  const { controller, changes } = setup();
  const first = controller.ask(options);
  const second = controller.ask({ ...options, title: 'Delete this prompt?' });
  assert.equal(await second, false);
  assert.deepEqual(changes, [options]);
  controller.resolve(true);
  assert.equal(await first, true);
  const next = controller.ask(options);
  controller.cancel();
  assert.equal(await next, false, 'a later independent confirmation is still usable');
});

test('unmount settles pending work without notifying the removed view', async function disposesPending() {
  const { controller, changes } = setup();
  const answer = controller.ask(options);
  controller.dispose();
  assert.equal(await answer, false);
  assert.deepEqual(changes, [options]);
  assert.equal(await controller.ask(options), false);
  controller.resolve(true);
  controller.cancel();
  controller.dispose();
  assert.deepEqual(changes, [options]);
});

test('unmount also invalidates approval that has not resumed yet', async function disposesApproved() {
  const { controller } = setup();
  const answer = controller.ask(options);
  controller.resolve(true);
  controller.dispose();
  assert.equal(await answer, false);
});
