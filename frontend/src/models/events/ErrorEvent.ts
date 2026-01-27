import { makeObservable, observable, action } from 'mobx';
import { Event } from './Event';

/**
 * 错误事件
 */
export class ErrorEvent extends Event {
  readonly type = 'error';

  @observable message: string;
  @observable code: string;

  constructor(data: { id: string; message: string; code: string }) {
    super(data.id);
    makeObservable(this);
    this.message = data.message;
    this.code = data.code;
  }

  @action
  update(data: Partial<ErrorEvent>) {
    if (data.message) this.message = data.message;
    if (data.code) this.code = data.code;
  }
}
