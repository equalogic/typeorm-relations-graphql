# TypeORM-GraphQL-Joiner
Builds a list of TypeORM entity relations to be joined based on object fields selected in a GraphQL query.

When your GraphQL server is backed by TypeORM entities, you may have object relationships like the following example:

```json5
{
  // Product entity
  "product": {
    "id": "1234",
    "name": "Some product",
    // nested Owner entity
    "owner": {
      "id": "4321",
      "name": "Some owner"
    }
  }
}
```

Let's say `product` corresponds to a `Product` entity in TypeORM, and it has a
[many-to-one relationship](https://typeorm.io/#/many-to-one-one-to-many-relations) to an `Owner` entity defined on the
`product.owner` property. In your database, you have a table for each of these entities.

Now you want to expose `Product` as an object in your GraphQL schema with the same relationship. You could simply
resolve `product.owner` using a database query to fetch the related `Owner` object, but if you create a GraphQL resolver
that returns a list of _n_ products then your server will need to perform _n_ + 1 database queries to fully resolve it.
This problem multiplies exponentially as your schema grows more complex and you have levels of nested relationships.

TypeORM-GraphQL-Joiner can help here by optimizing these relationships into SQL `JOIN`s. Instead of fetching the
`product` and then each `owner` individually, it enables you to fetch the `product` with all requested relationships
in a single database query by making use of TypeORM's `relations` [option](https://typeorm.io/#/find-options) on `find`
methods.

So in this simple example, instead of your resolvers producing this SQL:

```sql
SELECT * FROM product;
SELECT * FROM owner WHERE product_id = :x;
SELECT * FROM owner WHERE product_id = :y;
SELECT * FROM owner WHERE product_id = :z;
```

You can optimize it to:

```sql
SELECT * FROM product LEFT JOIN owner ON product.id = owner.product_id;
```

The value of this optimization increases as you have greater levels of nesting, of course.

You could join these relations manually (or eagerly) with TypeORM, but then you are likely to end up overfetching -
retrieving relations that were not requested by the client and producing SQL that is more expensive than necessary.
TypeORM-GraphQL-Joiner only joins relations that were requested in the client's GQL query.

## Installation

```
npm i typeorm-graphql-joiner
```

This library is written in TypeScript, so type definitions are included in the box.

Your project must also install the following as peer dependencies (you should have them already):

- [typeorm](https://typeorm.io/)
- [graphql](https://www.npmjs.com/package/graphql)

## Usage

First, create a `RelationMapper` instance, passing in a TypeORM `Connection` object (which provides access to entity
metadata):

```ts
import { getConnection } from 'typeorm';
import { RelationMapper } from 'typeorm-graphql-joiner';

const relationMapper = new RelationMapper(getConnection());
```

Inside a GraphQL query resolver (where you have a `GraphQLResolveInfo` object available) you can do the following:

#### `buildRelationListForQuery(entity: Entity, info: GraphQLResolveInfo): Set<string>`

Builds a list of relations for an entity matching the root of the GraphQL query. For example, if you have a `products`
query in your GQL schema which returns a list of `Product` entities (where the `Product` entity and `Product` GQL object
type are equivalent), you can simply map `Product` relations in this way:

```ts
import { GraphQLResolveInfo } from 'graphql';

// Example resolver function for a "products" query in your GQL schema
function products(source: any, args: any, context: any, info: GraphQLResolveInfo): Promise<Product[]> {
  const connection = getConnection();
  const relationMapper = new RelationMapper(connection);

  const productRelations: Set<string> = relationMapper.buildRelationListForQuery(Product, info);

  return connection.getRepository(Product).find({
    relations: [...productRelations],
  });
}
```

This method returns a [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), so
you need to spread it to create a plain array for TypeORM. A `Set` is used so that it is easy to manipulate the list by
adding or removing relations without worrying about creating duplicate entries.

#### `buildRelationListForQuery(entity: Entity, info: GraphQLResolveInfo, path: string): Set<string>`

In some cases you may need to map relations to entity fields where the GQL object type for the entity is not the root
node in the query. A common example of this is in a mutation which returns a payload object containing the modified
object rather than the object directly. In this case you can pass a `path` string as the last argument to
`buildRelationListForQuery`:

```ts
import { GraphQLResolveInfo } from 'graphql';

// Example resolver function for a "createProduct" mutation in your GQL schema
async function createProduct(source: any, args: any, context: any, info: GraphQLResolveInfo): Promise<CreateProductPayload> {
  const connection = getConnection();
  const relationMapper = new RelationMapper(connection);

  // Create the new product
  const product: Product = await connection.getRepository(Product).save(
    connection.getRepository(Product).create({
      name: 'New Product',
    }),
  );

  // Create payload and re-fetch the new product to retrieve all requested relations
  const payload: CreateProductPayload = {
    success: true,
    product: await connection.getRepository(Product).findOneOrFail(product.id, {
      relations: [...relationMapper.buildRelationListForQuery(Product, info, 'product')],
    }),
  };

  return payload;
}
```

A GraphQL query for this mutation might look like:

```graphql
mutation {
  createProduct {
    success
    product {
      id
      name
      owner {
        id
        name
      }
    }
  }
}
```

The `Product` entity here exists below the root level of the object being resolved (`createProduct`), at a field called
`product`. So the path `'product'` must be given to `buildRelationListForQuery`.

Dotted path notation can be used when the entity is at an even lower level in the node tree. For example, the path
`'product.owner'` could be used to map the `Owner` entity in this example.

#### `buildRelationList(entity: Entity, baseNode: SelectionNode, fragments?: Record<string, FragmentDefinitionNode>): Set<string>`

This method works like `buildRelationListForQuery` (and is called by it internally), but it can operate on an arbitrary
`SelectionNode` rather than requiring an entire `GraphQLResolveInfo` object.

If your GQL for the selection may contain named fragments, the definition of those fragments must be passed through.
The required data can be retrieved from the `fragments` property on the top level `GraphQLResolveInfo` object.

#### `findQueryNode(fieldPath: string, info: GraphQLResolveInfo): SelectionNode | null`

Returns the `SelectionNode` for the referenced field if it was selected in the GQL query represented by `info`. Returns
`null` if the field is not selected by the query.

Nested fields can be located using dotted `'parentField.childField.grandchildField'` notation.

#### `isFieldSelected(fieldPath: string, info: GraphQLResolveInfo): boolean`

Like `findQueryNode` but just returns a boolean indicating whether the referenced field is selected in the GQL query
represented by `info`.
