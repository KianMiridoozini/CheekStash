import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { File } from 'multer';

@Injectable()
export class CloudinaryService {
    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
        });
    }

    async uploadImage(file: File, folder = 'user-avatars') {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                },
            ).end(file.buffer);
        });
    }

    async deleteImage(publicId: string) {
        return cloudinary.uploader.destroy(publicId);
    }
}
