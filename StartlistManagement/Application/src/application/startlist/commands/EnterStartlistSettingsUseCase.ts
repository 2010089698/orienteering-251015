import { StartlistFactory } from '../../../../../Domain/src/startlist/StartlistFactory';
import { StartlistRepository } from '../../../../../Domain/src/startlist/StartlistRepository';
import { StartlistSnapshot } from '../../../../../Domain/src/startlist/StartlistSnapshot';
import { ApplicationEventPublisher } from '../../shared/event-publisher';
import { TransactionManager } from '../../shared/transaction';
import { toStartlistSettings } from '../dto/StartlistMappers';
import { EnterStartlistSettingsCommand } from '../dto/StartlistDtos';
import { StartlistCommandBase } from './StartlistCommandBase';

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
