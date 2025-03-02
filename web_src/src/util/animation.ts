import { add, scale, Vec2 } from "./points";

export class ScalarAnimation {
  private curr: number;
  private target: number
  private progress: number
  private duration: number

  constructor (init: number, config: {duration: number}) {
    this.curr = init
    this.target = init
    this.progress = 1
    this.duration = config.duration
  }
  setTarget(val: number) {
    this.curr = this.valueNow()
    this.progress = 0
    this.target = val
  }

  finishNow() {
    this.curr = this.target
    this.progress = 1
  }

  inProgress() {
    return this.progress < 1
  }

  passTime(secs: number) {
    const delta = secs / this.duration
    this.progress = Math.max(0, Math.min(1, this.progress + delta))
  }

  valueNow() {
    return this.curr * (1-this.progress) + this.target * this.progress
  }
}


export class Vec2Animation {
  private curr: Vec2;
  private target: Vec2 
  private progress: number
  private duration: number

  constructor (init: Vec2, config: {duration: number}) {
    this.curr = init
    this.target = init
    this.progress = 1
    this.duration = config.duration
  }
  setTarget(val: Vec2) {
    this.curr = this.valueNow()
    this.progress = 0
    this.target = val
  }

  finishNow() {
    this.curr = this.target
    this.progress = 1
  }

  cancel() {
    this.curr = this.valueNow()
    this.progress = 1
  }

  inProgress() {
    return this.progress < 1
  }

  passTime(secs: number) {
    const delta = secs / this.duration
    this.progress = Math.max(0, Math.min(1, this.progress + delta))
  }

  valueNow() {
    return add(scale((1-this.progress), this.curr), scale(this.progress, this.target))
  }
}
