# CONTEXT.md

This document gives future agents and contributors a common way to talk about `scope-log`. It is not a design doctrine or a full architecture model; it is a small shared vocabulary for implementation work, reviews, and planning notes.

The code is still the source of truth. Use this document to keep discussions clear, especially when a change touches namespace parsing, log-level behavior, logging calls, or output delivery.

## Shared Language

Use these terms when they make a discussion clearer. Prefer the plain term over implementation details unless you are pointing at a specific file, function, or field.

### Nouns

| Term                       | Meaning                                                                                                    | Use when talking about                                                    | Avoid                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| namespace                  | A colon-separated identity such as `Checkout:Pricing`. This is the main naming idea in the package.        | Parser rules, tree structure, logger binding, and filtering.              | Using `scope` as the technical synonym. Reserve `scope-log` for the package name or casual prose. |
| root namespace             | The top of the namespace tree, expressed by `RootNamespace` or `$`.                                        | Behavior that applies to the whole tree.                                  | Saying "global scope" unless you mean JavaScript runtime scope.                                   |
| wildcard namespace pattern | A namespace ending in `:*`, such as `Checkout:*`, that applies to a namespace and its descendants.         | Subtree log-level configuration and queries.                              | Calling it a regex or a generic matcher.                                                          |
| namespace tree             | The stored hierarchy of namespace nodes.                                                                   | Traversal, lookup, and stored namespace state.                            | Calling it a graph when the behavior depends on tree semantics.                                   |
| exact level                | The level configured for one exact namespace. Implementation alias: `nodeLevel`.                           | `setLogLevel('A:B', level)` behavior.                                     | Using `node level` as the main concept name.                                                      |
| cascading level            | The level configured for a namespace subtree. Implementation alias: `cascadingLevel`.                      | `setLogLevel('A:B:*', level)` behavior.                                   | Calling it inherited level as if it only exists after resolution.                                 |
| effective level            | The level that actually decides whether a log call is allowed after exact and cascading rules are applied. | `shouldLog` and runtime filtering behavior.                               | Mixing it up with stored configuration.                                                           |
| override                   | An explicit exact or cascading level assignment that changes behavior from the root default or cascade.    | Runtime control, debugging workflows, inspection, and future persistence. | Using `default` for a non-default explicit setting.                                               |
| logger                     | The callable object returned by `scopedLog(...)`, usually bound to one namespace.                          | Call sites that emit log events.                                          | Using `scope` to refer to the returned object.                                                    |
| log emission               | The act of checking whether a log should fire and preparing its arguments for output.                      | Eager vs lazy logging, prefix behavior, and dispatch decisions.           | Using `render` or `print` for the whole process.                                                  |
| outputter                  | A pluggable destination function for log events.                                                           | `addOutputter`, `removeOutputter`, console output, and dispatch behavior. | Using `sink`, `transport`, or `reporter` as the primary term.                                     |
| shared registry            | Shared runtime infrastructure that stores namespace state and outputters.                                  | The `globalThis[Symbol.for(...)]` backed runtime state.                   | Treating it as a product area or feature in its own right.                                        |

### Verbs

| Verb      | Use it for                                                                      | Avoid using it as a vague stand-in for |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| parse     | Turning a namespace string into validated parts and root or wildcard semantics. | handle, process                        |
| configure | Setting an exact level or cascading level.                                      | resolve, emit                          |
| resolve   | Determining the effective level that governs a log decision.                    | configure, dispatch                    |
| emit      | Producing a log event from a logger call site.                                  | dispatch, print                        |
| dispatch  | Sending an emitted event to one or more outputters.                             | emit                                   |
| inspect   | Reading namespace or outputter state without changing it.                       | configure                              |
| persist   | Storing explicit override state across reloads.                                 | cache, resolve                         |

## Areas Of The Package

These names are useful handles for scoping changes. They are not DDD bounded contexts and do not imply ownership rules beyond keeping conversations precise.

| Area                     | Status  | Meaning                                                                                                   |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------- |
| Namespace Model          | Current | Namespace syntax, root semantics, wildcard semantics, and namespace identity.                             |
| Level Resolution         | Current | Exact levels, cascading levels, effective levels, and the rules that decide whether a log fires.          |
| Log Emission             | Current | Logger creation, prefix behavior, eager vs lazy emission, and the decision to dispatch.                   |
| Output Delivery          | Current | The outputter contract and delivery of emitted events to destinations such as the console.                |
| Runtime Control Surface  | Future  | A developer-facing runtime API for configuring and listing overrides.                                     |
| Persistence of Overrides | Future  | A storage-backed mechanism for preserving explicit override state across reloads.                         |
| Namespace Discovery      | Future  | A read-oriented inspection surface for known namespaces and effective state.                              |
| UI or Devtools           | Future  | A consumer-facing control layer that uses discovery and runtime control without redefining core behavior. |

When a future area is mentioned, treat it as a planning label. It should describe where a possible feature might fit, not make the feature authoritative before it exists.

## How The Pieces Relate

### Current Behavior

- Namespace Model defines the strings and tree shape used by the rest of the package.
- Level Resolution uses namespace state to decide the effective level for a namespace.
- Log Emission asks Level Resolution whether a logger call should produce an event.
- Log Emission dispatches emitted events to Output Delivery.
- Output Delivery sends events to configured outputters and should not redefine namespace or level behavior.
- The shared registry stores the namespace tree and outputter list. It is infrastructure used by the package, not a separate feature area.

### External Use

- Package consumers create loggers through Log Emission.
- Package consumers configure exact and cascading level overrides through Level Resolution.
- The runtime environment hosts the shared registry and default console behavior.
- Runtime details can affect how shared state behaves, especially across separate JavaScript realms.

### Future Work

- Runtime Control Surface would configure Level Resolution through explicit overrides.
- Persistence of Overrides would store explicit overrides, not derived effective levels, unless there is a strong reason to do more.
- Namespace Discovery would inspect namespace state and effective behavior without changing configuration rules.
- UI or Devtools would consume Namespace Discovery and act through Runtime Control Surface.
- Future features should reuse Namespace Model, Level Resolution, Log Emission, and Output Delivery vocabulary instead of inventing parallel terms.

## Using This In Agent Prompts

Start with the relevant package area, then describe the behavior in plain language. This keeps prompts short while still giving the agent a useful map.

Good examples:

- "Update Level Resolution so an exact level keeps beating a cascading level."
- "Change Log Emission so lazy debug logging does not evaluate the thunk when the log is filtered out."
- "Add Namespace Discovery for known namespaces without changing namespace parsing rules."
- "Keep UI or Devtools as a consumer of Runtime Control Surface and Namespace Discovery."

Scoping shortcuts:

- If the change alters valid namespace syntax, root meaning, or wildcard meaning, it belongs in Namespace Model.
- If the change alters exact vs cascading precedence or `shouldLog` outcomes, it belongs in Level Resolution.
- If the change alters prefixing, eager vs lazy behavior, or when a logger dispatches, it belongs in Log Emission.
- If the change alters console mapping or custom destination behavior, it belongs in Output Delivery.
- If the change adds interactive controls, inspection UI, or stored runtime state, treat it as future work layered on top of the current package.
