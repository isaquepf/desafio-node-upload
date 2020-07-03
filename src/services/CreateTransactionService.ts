import { getRepository, getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const availableOperations = ['income', 'outcome'];

    if (!availableOperations.includes(type))
      throw new AppError('Invalid operation!', 401);

    const { total } = await transactionsRepository.getBalance();

    if (type === 'outcome' && total < value)
      throw new AppError('Insufficient balance.');

    const _category = await this.handleCategory(category);

    const transaction = transactionsRepository.create({
      title,
      type,
      category_id: _category?.id,
      value,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }

  private async handleCategory(category: string): Promise<Category> {
    const categoryRepository = getRepository(Category);

    let categoryResult = await categoryRepository.findOne({
      title: category,
    });

    if (!categoryResult) {
      const categoryDomain = await categoryRepository.create({
        title: category,
      });
      categoryResult = await categoryRepository.save(categoryDomain);
    }
    return categoryResult;
  }
}

export default CreateTransactionService;
