export enum OrgFileNodeType {
  FOLDER = 'folder',
  FILE = 'file',
}

export const ORG_FILE_ERRORS = {
  NOT_FOUND: 'File or folder not found.',
  PARENT_NOT_FOUND: 'Parent folder not found.',
  PARENT_MUST_BE_FOLDER: 'Parent node must be a folder.',
  CANNOT_MOVE_INTO_SELF: 'Cannot move a folder into itself or its descendant.',
  CANNOT_DELETE_FILE_NODE: 'Only files can have a storage key.',
  NAME_REQUIRED: 'Name is required.',
};

export const ORG_FILE_RESPONSES = {
  FOLDER_CREATED: 'Folder created successfully.',
  FILE_UPLOADED: 'File uploaded successfully.',
  RENAMED: 'Renamed successfully.',
  MOVED: 'Moved successfully.',
  DELETED: 'Deleted successfully.',
  FETCHED: 'Fetched successfully.',
};

export const ORG_FILE_ENTITY_LABEL = 'Org File';

export const ORG_FILES_UPLOAD_FOLDER = 'org-files';

export const ORG_FILE_FIELD_NAME = 'orgFiles';

export const ORG_FILE_SORT_FIELD_MAPPING: Record<string, string> = {
  name: 'n."name"',
  type: 'n."type"',
  createdAt: 'n."createdAt"',
  updatedAt: 'n."updatedAt"',
};
