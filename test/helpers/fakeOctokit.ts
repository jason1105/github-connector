export function createFakeOctokit(mocks: {
  getTree?: any;
  getRef?: any;
  createRef?: any;
  getContent?: any;
  createOrUpdateFileContents?: any;
  create?: any;
  listForRepo?: any;
  get?: any;
  createComment?: any;
  list?: any;
  merge?: any;
}) {
  return {
    rest: {
      git: {
        getTree: mocks.getTree,
        getRef: mocks.getRef,
        createRef: mocks.createRef,
      },
      repos: {
        getContent: mocks.getContent,
        createOrUpdateFileContents: mocks.createOrUpdateFileContents,
      },
      issues: {
        create: mocks.create,
        listForRepo: mocks.listForRepo,
        get: mocks.get,
        createComment: mocks.createComment,
      },
      pulls: {
        create: mocks.create,
        list: mocks.list,
        get: mocks.get,
        merge: mocks.merge,
      },
    },
  } as any;
}
