import { makeObservable, observable } from 'mobx';
import { ConversationItem } from './ConversationItem';

/**
 * 用户消息
 */
export class UserMessage extends ConversationItem {
  readonly role = 'user' as const;
  @observable content: string;
  @observable attachments?: Array<{ type: string; url: string; name: string }>;

  constructor(data: {
    id: string;
    content: string;
    attachments?: Array<{ type: string; url: string; name: string }>;
  }) {
    super(data.id);
    makeObservable(this);
    this.content = data.content;
    this.attachments = data.attachments;
  }
}
