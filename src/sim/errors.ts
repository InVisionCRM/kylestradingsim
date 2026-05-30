/** Base class for all simulator order errors. Thrown by the engine, caught by the UI. */
export class SimError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
export class InsufficientFundsError extends SimError {}
export class OversellError extends SimError {}
export class InvalidOrderError extends SimError {}
