import { action } from 'mobx';
import { Event } from './Event';

/**
 * 思考状态事件
 */
export class ThinkingEvent extends Event {
  readonly type = 'thinking';

  constructor(id: string) {
    super(id);
  }

  @action
  update() {
    // 思考事件不需要更新
  }
}
