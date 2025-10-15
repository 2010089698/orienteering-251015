import {
  StartlistFactory,
  StartlistRepository,
  StartlistSnapshot,
} from '@startlist-management/domain';
import { ApplicationEventPublisher } from '../../shared/event-publisher.js';
import { TransactionManager } from '../../shared/transaction.js';
import { toStartlistSettings } from '../dto/StartlistMappers.js';
import { EnterStartlistSettingsCommand } from '../dto/StartlistDtos.js';
import { StartlistCommandBase } from './StartlistCommandBase.js';

export interface EnterStartlistSettingsUseCase {
  execute(command: EnterStartlistSettingsCommand): Promise<StartlistSnapshot>;
}

export class EnterStartlistSettingsService
  extends StartlistCommandBase
  implements EnterStartlistSettingsUseCase
{
  constructor(
    repository: StartlistRepository,
    transactionManager: TransactionManager,
    eventPublisher: ApplicationEventPublisher,
    factory: StartlistFactory,
  ) {
    super(repository, transactionManager, eventPublisher, factory);
  }

  async execute(command: EnterStartlistSettingsCommand): Promise<StartlistSnapshot> {
    return this.executeOnStartlist(
      command.startlistId,
      (startlist) => {
        const settings = toStartlistSettings(command.settings);
        startlist.enterSettings(settings);
      },
      { allowCreate: true },
    );
  }
}
