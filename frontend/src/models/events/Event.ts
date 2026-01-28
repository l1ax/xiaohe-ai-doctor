import { makeObservable, observable } from 'mobx';

/**
 * Event 基类 - 所有 Agent 输出事件的基类
 */
export abstract class Event {
  @observable id: string;
  @observable timestamp: Date;
  abstract readonly type: string;

  constructor(id: string) {
    makeObservable(this);
    this.id = id;
    this.timestamp = new Date();
  }

  abstract update(data: any): void;
}
