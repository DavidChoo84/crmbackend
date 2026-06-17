import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { userId, email, password } = createUserDto;

    // Guard against duplicated credentials
    const existingUser = await this.userRepo.findOne({
      where: [{ userId }, { email }],
    });

    if (existingUser) {
      throw new ConflictException('User ID or Email already exists');
    }

    // Secure password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = this.userRepo.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return await this.userRepo.save(newUser);
  }

  async findOneById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { userId } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }
}