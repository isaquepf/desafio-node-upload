import fs from 'fs';
import csvparse from 'csv-parse';
import { getRepository, In } from 'typeorm';
import _ from 'underscore';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

const transactions = new Array<TransactionDTO>();
let categories = new Array<string>();

interface TransactionDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  categoryTitle: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const fileStream = fs.createReadStream(filePath);

    const parsers = csvparse({
      delimiter: ',',
      from_line: 2,
    });

    const csv = fileStream.pipe(parsers);

    csv.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, categoryTitle: category });
    });

    await new Promise(resolve => csv.on('end', resolve));

    const { newCategories, existentCategories } = await this.handleCategories();

    const newTransactions = await this.handleTransactions({
      newCategories,
      existentCategories,
    });

    await fs.promises.unlink(filePath);

    return newTransactions;
  }

  private async handleTransactions({
    newCategories,
    existentCategories,
  }: {
    newCategories: Category[];
    existentCategories: Category[];
  }) {
    const transactionRepository = getRepository(Transaction);

    const allCategories = [...newCategories, ...existentCategories];

    const newTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id: allCategories.find(
          category => category.title === transaction.categoryTitle,
        )?.id,
      })),
    );

    await transactionRepository.save(newTransactions);

    return newTransactions;
  }

  private async handleCategories() {
    const categoryRepository = getRepository(Category);

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const titles = _.pluck(existentCategories, 'title');

    const newCategories = new Array<Category>();

    categories = _.uniq(categories);
    categories.map((categoryTitle: string) => {
      if (!titles.includes(categoryTitle)) {
        newCategories.push(categoryRepository.create({ title: categoryTitle }));
      }
    });

    categoryRepository.save(newCategories);
    return { newCategories, existentCategories };
  }
}

export default ImportTransactionsService;
