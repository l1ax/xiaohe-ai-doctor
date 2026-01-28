import { makeObservable, observable, action } from 'mobx';
import { Event } from './Event';

/**
 * 消息内容事件（流式）
 */
export class MessageContentEvent extends Event {
  readonly type = 'message_content';

  @observable content: string = '';
  @observable isComplete: boolean = false;

  constructor(data: { id: string; delta?: string; isLast?: boolean }) {
    super(data.id);
    makeObservable(this);
    if (data.delta) {
      this.content = data.delta;
    }
    if (data.isLast) {
      this.isComplete = true;
    }
  }

  @action
  update(data: { delta?: string; isLast?: boolean }) {
    if (data.delta) {
      this.content += data.delta;
    }
    if (data.isLast) {
      this.isComplete = true;
    }
  }
}
