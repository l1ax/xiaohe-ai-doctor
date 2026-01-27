import { makeObservable, observable } from 'mobx';

/**
 * 对话项基类
 */
export abstract class ConversationItem {
  @observable id: string;
  @observable timestamp: Date;
  abstract readonly role: 'user' | 'agent';

  constructor(id: string) {
    makeObservable(this);
    this.id = id;
    this.timestamp = new Date();
  }
}
