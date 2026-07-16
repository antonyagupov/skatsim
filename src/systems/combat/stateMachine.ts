export type BattleState =
  | "PLAYER_INPUT"
  | "SWAP_ANIMATION"
  | "MATCH_RESOLUTION"
  | "CASCADE_RESOLUTION"
  | "HERO_ATTACKS"
  | "ABILITY_RESOLUTION"
  | "ENEMY_TURN"
  | "VICTORY"
  | "DEFEAT";

export class BattleStateMachine {
  private _state: BattleState = "PLAYER_INPUT";

  get state(): BattleState {
    return this._state;
  }

  get acceptsInput(): boolean {
    return this._state === "PLAYER_INPUT";
  }

  set(next: BattleState): void {
    this._state = next;
  }

  reset(): void {
    this._state = "PLAYER_INPUT";
  }
}
