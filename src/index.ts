const prismaSchemas = [
	`model Organization {
		id                    Int                      @id @default(autoincrement())
		orgName               String
		orgSlogan             String?
		orgBrandColor         String?
		orgLink               String?
		orgCountry            Country?                 @relation(fields: [countryCode], references: [code])
		orgAddress            String?
		orgCity               String?
		orgState              State?                   @relation(fields: [stateCode], references: [code])
		orgPostalCode         String?
		orgSupportEmail       String?
		orgSupportPhone       String?
		youTubeHandle         String?
		instagramHandle       String?
		twitterHandle         String?
		facebookHandle        String?
		createdAt             DateTime                 @default(now())
		logo                  Media?                   @relation(name: "logo", fields: [logoId], references: [id])
		logoId                Int?
		currency              Currency?                @relation(name: "currency", fields: [currencyCode], references: [code])
		currencyCode          String?                  @default("INR")
		customDomain          String?
		isValidCustomDomain   Boolean?                 @default(false)
		priceDelimiter        String?                  @default("@")
		categoryDelimiter     String?                  @default("*")
		titleDelimiter        String?                  @default("~")
		descriptionDelimiter  String?                  @default("\`")
		customDomainCreatedAt DateTime?
		gstNumber             String?
		isRatesTaxInclusive   Boolean?
		razorPayAccountId     String?
		media                 Media[]
		user                  User[]
		categories            Category[]
		products              Product[]
		taxes                 Tax[]
		orders                Order[]
		countryCode           String?
		stateCode             String?
		heroSection           HeroSection?
		paymentMethod         PaymentMethod[]
		bankDetails           BankDetails?
		businessCategory      BusinessCategory?        @relation(fields: [businessCategoryId], references: [id])
		businessCategoryId    Int?
		pushNotificationToken PushNotificationTokens[]
		telegramChatId        String?
		pages                 Pages[]
		googleAnalyticsCode   String?
		SectionOnOrganization SectionOnOrganization[]
		PageLayout            PageLayout[]
		subscription          Subscription?
		theme                 String?                  @default("Storefront")
		productImageShape     ProductImageShape?       @default(SQUARE)
		settings              Json?
		shipping              Shipping[]
		storeMode             Boolean                  @default(false)
	}`,
	`model Session {
        id           String   @id @default(cuid())
        sessionToken String   @unique
        userId       String
        expires      DateTime
        user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    }`,
];

const convertPrismaToDrizzle = (prismaSchemas: string[]) => {
	prismaSchemas.forEach((prismaSchema) => {
		const schemaFields = prismaSchema.split(/\r?\n/);
		schemaFields.pop();
		const interestedParts = schemaFields;
		const modelName = interestedParts?.[0]
			?.match(/(?<=(model)+)(.*?)(?=\{)/)?.[0]
			?.trim()
			?.toLowerCase();

		let drizzleFields = [];
		drizzleFields.push(`export const ${modelName} = sqliteTable("${modelName}", {`);
		for (let i = 1; i < interestedParts?.length; i++) {
			let field;

			if (interestedParts[i]?.indexOf('@relation') >= 0) {
				field = extractRelation(interestedParts[i]);
			} else {
				field = interestedParts[i].trim().replace(/[ ,]+/g, ',');
			}

			const parts = field ? field.split(',') : null;
			const snakeCase = parts?.[0] ? parts[0].replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) : parts?.[0];
			const relation = parts?.[3] && parts?.[3] != null && parts?.[3] != undefined ? parts?.[3] : parts?.[2];
			const type = parts?.[1] ? convertType(parts[1], snakeCase, relation) : parts?.[1];
			const decorator = convertRelation(relation, parts?.[1], snakeCase);
			const final = parts?.[0] + ': ' + type + decorator;
			drizzleFields.push(final);
		}
		drizzleFields.push('}');
		console.log(drizzleFields.join('\n\t'));
	});
};

const extractRelation = (part: string) => {
	let matches = part.match('@relation');
	if (matches && matches.length > 0 && matches?.index) {
		let relationPart = part.substr(matches.index, part.length);
		let fieldPart = part.replace(relationPart, '').trim().replace(/[ ,]+/g, ',');
		// console.log(fieldPart + "," +relationPart);
		return fieldPart + ',' + relationPart;
	} else {
		return part;
	}
};

const convertType = (type: string | null | undefined, snakecase: string | null | undefined, relation?: string | null) => {
	if (type) {
		if (type.indexOf('Int?') >= 0 && type.indexOf('Int?') >= 0) {
			return 'integer("' + snakecase + '")';
		} else if (type.indexOf('Int') >= 0 && type.indexOf('Int?') < 0) {
			return 'integer("' + snakecase + '").notNull()';
		} else if (type.indexOf('String') >= 0) {
			return 'text("' + snakecase + '")';
		} else if (type.indexOf('Boolean') >= 0) {
			return 'integer("' + snakecase + '")';
		} else if (type.indexOf('DateTime') >= 0) {
			return "integer('created_at', { mode: 'timestamp' })";
		} else {
			const value = relation?.split('references: [')?.[1]?.replace(']', '');
			return "text('" + type?.toLowerCase()?.replace('?', '') + '_' + value + "')";
		}
	} else {
		return type;
	}
};

const convertRelation = (relation: string | null | undefined, type?: string | null, snakeCase?: string | null) => {
	if (!relation) {
		return ',';
	}

	if (relation.indexOf('@default') >= 0 && relation.indexOf('autoincrement()') < 0 && relation.indexOf('@default(now())') < 0) {
		let value;

		if (type && type?.indexOf('Boolean') >= 0) {
			value = relation?.replace('@default(', '').replace(')', '');
			value = value == 'true' ? '1' : '0';
		} else {
			value = relation.indexOf("@default('") >= 0 ? relation?.replace("@default('", '').replace("')", '') : relation?.replace('@default(', '').replace(')', '');
		}

		return relation.indexOf("@default('") >= 0 ? '.default("' + value + '"),' : '.default(' + value + '),';
	} else if (relation.indexOf('@default(now())') >= 0) {
		return ".default(sql`(strftime('%s', 'now'))`),";
	} else if (relation.indexOf('@default') >= 0 && relation.indexOf('autoincrement()') >= 0) {
		return '.primaryKey(),';
	} else if (relation.indexOf('references') >= 0 && type) {
		const value = relation?.split('references: [')?.[1]?.replace(']', '');
		return '.references(()=> ' + snakeCase + '.' + value + ',';
	} else {
		return '';
	}
};

convertPrismaToDrizzle(prismaSchemas);
