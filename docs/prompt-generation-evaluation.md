# Prompt generation scope checks

Use these cases after changing generation instructions. They evaluate the generated prompt's meaning, not whether the model repeats particular wording. Mocked transport unit tests prove that the API forwards the idea, context, and options correctly; they cannot prove that a real model preserves scope.

## Procedure

1. Use a temporary evaluation group with synthetic project context. Select GPT-6 Luna, clear tone, and structured format unless a case says otherwise.
2. Generate each case once and inspect the complete output. Evaluate the prompt only; do not execute its embedded application, commit, or deployment instructions.
3. Check every requested action, exclusion, explicit order, quantity, and other boundary. Relevant context should make the prompt usable in a fresh chat without creating additional tasks.
4. Fail an output if it adds independent work, silently reduces coverage, changes an explicit constraint, or replaces a requested action with a weaker one. Necessary execution details are acceptable when they serve the requested outcome.
5. Record the model, date, generated text, and a pass/fail reason for each case. Keep failures visible when trying a revision; one successful generation is useful evidence, not a guarantee of consistent behavior. Repeat with other supported models when assessing their behavior.

Use this shared context to test whether background development guidance accidentally expands the task:

> Demo Workshop is a TypeScript application with saved prompts, groups, and project context. Existing repository conventions require linting and relevant unit tests when code changes. Preserve existing behavior and unrelated uncommitted work. Future ideas include shared accounts and calendar integration; these are not implemented requirements. The deployment target is the project's existing Render service.

## 1. Release existing work and test all functionality

**Preset:** Build

**Idea:** `Create a commit, push and deploy. Then test all functionality in the application through the UI.`

Pass when the output preserves commit → push → deploy → UI testing, releases existing work, and retains **all functionality** as the coverage target. It may ask the eventual assistant to identify the application's workflows and report any blocked or unverified coverage. It must not introduce feature implementation, automatic bug fixing, future roadmap work, or substitute only affected/relevant workflows for all functionality.

## 2. Review only, with explicit exclusions

**Preset:** Build

**Idea:** `Review only the authentication diff and list bugs. Do not edit files, run tests, commit, push, or deploy.`

Pass when the output requests a review limited to the authentication diff and retains every prohibition. The Build preset and repository testing conventions must not add implementation, test execution, deployment, or a whole-application audit.

## 3. Keep explicitly requested implementation

**Preset:** Build

**Idea:** `Build a tag filter for saved prompts, add unit tests, and deploy it. Leave groups unchanged.`

Pass when all three actions remain, together with the restriction on groups. The output may apply the supplied conventions for changed code. It must not reduce the task to a plan or review, omit deployment, add unrelated features, or turn the tag filter into a broader redesign.

## 4. Preserve a noncoding request despite the preset

**Preset:** Research; **Format:** Concise

**Idea:** `Rewrite this message in a friendlier tone, under 80 words. Keep Friday and $250 unchanged: "Sam, send the revised estimate by Friday. The budget is $250."`

Pass when the output is a reusable instruction to rewrite that message, retaining its text, tone request, word limit, date, and amount. The 80-word limit applies to the eventual rewritten message. The Research preset and software project context must not add research, technical work, alternative deliverables, or invented facts. The builder should generate the prompt rather than perform the rewrite itself.

## Results

No live results are recorded in this document yet. Keep actual evaluation observations separate from these expected outcomes.
