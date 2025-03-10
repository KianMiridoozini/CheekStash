import { Test, TestingModule } from '@nestjs/testing';
import { CheeksController } from './cheeks.controller';

describe('CheeksController', () => {
  let controller: CheeksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheeksController],
    }).compile();

    controller = module.get<CheeksController>(CheeksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
