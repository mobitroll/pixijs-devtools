declare module 'launch-editor/guess.js' {
  /** Returns the running editor's command(s), e.g. ['code'] | ['code-insiders'] | ['webstorm']. */
  const guess: () => Array<string | undefined>;
  export default guess;
}
