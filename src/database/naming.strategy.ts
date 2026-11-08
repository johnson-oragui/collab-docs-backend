import { DefaultNamingStrategy, Table } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils.js';

export class DatabaseNamingStrategy extends DefaultNamingStrategy {
  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    return `pk_${tableName}_${columnNames.join('_')}`;
  }

  // Generates: uq_tablename_columnname (e.g., uq_users_email)
  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    return `uq_${tableName}_${columnNames.join('_')}`;
  }

  // Generates: fk_tablename_columnname_referencedtable (e.g., fk_posts_user_id_users)
  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    referencedTablePath?: string,
    referencedColumnNames?: string[],
  ): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    return `fk_${tableName}_${columnNames.join('_')}_${referencedTablePath}`;
  }

  // Generates: idx_tablename_columnname (e.g., idx_users_email)
  indexName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    const tableName = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    return `idx_${tableName}_${columnNames.join('_')}`;
  }

  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    if (customName) return customName;
    const prefix = embeddedPrefixes.length ? embeddedPrefixes.join('_') + '_' : '';
    return prefix + snakeCase(propertyName);
  }

  joinColumnName(relationName: string, invertedPropertyName: string): string {
    return snakeCase(`${relationName}_${invertedPropertyName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return snakeCase(`${firstTableName}_${firstPropertyName}_${secondTableName}`);
  }
}