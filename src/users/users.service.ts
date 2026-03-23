import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  async create(
    username: string,
    password: string,
    role: UserRole = UserRole.USER,
    forceCreate = false,
  ) {
    const existing = await this.usersRepo.findOne({ where: { username } });
    if (existing && !forceCreate) return existing;

    const hashed = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({
      username,
      password: hashed,
      role,
    });
    return this.usersRepo.save(user);
  }

  findByUsername(username: string) {
    return this.usersRepo.findOne({ where: { username } });
  }

  findAll() {
    return this.usersRepo.find();
  }

  findById(id: number) {
    return this.usersRepo.findOne({ where: { id } });
  }
}
