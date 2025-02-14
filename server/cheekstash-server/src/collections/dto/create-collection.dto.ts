export class CreateCollectionDto {
    readonly title: string;
    readonly description?: string;
    readonly tags?: string[];
    readonly category: string;
    readonly isPublic?: boolean;
    readonly links?: {
      url: string;
      title: string;
      description?: string;
      order?: number;
    }[];
  }
  