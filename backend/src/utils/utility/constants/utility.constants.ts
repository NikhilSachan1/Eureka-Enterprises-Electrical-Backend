export enum DataSuccessOperationType {
  CREATE = 'created',
  UPDATE = 'updated',
  DELETE = 'deleted',
  UPLOAD = 'uploaded',
}

export enum DataFailureOperationType {
  CREATE = 'add',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum DefaultPaginationValues {
  SORT_ORDER = 'DESC',
  SORT_FIELD = 'createdAt',
  PAGE_SIZE = 10,
  PAGE = 1,
}

export const PAGNIATION_ERRORS = {
  INVALID_SORT_ORDER: 'Invalid sort order',
};
