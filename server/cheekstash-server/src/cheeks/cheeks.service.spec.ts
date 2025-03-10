import { Test, TestingModule } from '@nestjs/testing';
import { CheeksService } from './cheeks.service';

describe('CheeksService', () => {
  let service: CheeksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheeksService],
    }).compile();

    service = module.get<CheeksService>(CheeksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
