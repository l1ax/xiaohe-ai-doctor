import { makeObservable, observable, action } from 'mobx';
import { Event } from './Event';

/**
 * 消息操作接口
 */
export interface MessageAction {
  type: 'recommend_doctor' | 'transfer_to_doctor' | 'book_appointment' | 'retry' | 'cancel' | 'view_more';
  label: string;
  data?: {
    doctorId?: string;
    doctorName?: string;
    hospital?: string;
    department?: string;
    [key: string]: any;
  };
}

/**
 * 消息元数据事件（包含 actions 等）
 */
export class MessageMetadataEvent extends Event {
  readonly type = 'message_metadata';

  @observable actions: MessageAction[] = [];

  constructor(data: { id: string; actions?: MessageAction[] }) {
    super(data.id);
    makeObservable(this);
    if (data.actions) {
      this.actions = data.actions;
    }
  }

  @action
  update(data: { actions?: MessageAction[] }) {
    if (data.actions) {
      this.actions = data.actions;
    }
  }
}
