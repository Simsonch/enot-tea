var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException, } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {} from './orders.dto.js';
let OrdersService = class OrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    allowedTransitions = new Map([
        [OrderStatus.NEW, new Set([OrderStatus.CONFIRMED, OrderStatus.CANCELLED])],
        [OrderStatus.CONFIRMED, new Set([OrderStatus.PACKED, OrderStatus.CANCELLED])],
        [OrderStatus.PACKED, new Set([OrderStatus.SHIPPED, OrderStatus.CANCELLED])],
        [OrderStatus.SHIPPED, new Set([OrderStatus.DELIVERED])],
        [OrderStatus.DELIVERED, new Set()],
        [OrderStatus.CANCELLED, new Set()],
    ]);
    statusEndpointAllowedTargets = new Set([
        OrderStatus.CONFIRMED,
        OrderStatus.PACKED,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
    ]);
    async create(dto) {
        return this.prisma.$transaction(async (tx) => {
            await this.ensureCustomerExists(tx, dto.customerId);
            const requestedItems = this.aggregateItems(dto.items);
            const productIds = requestedItems.map((item) => item.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, priceMinor: true },
            });
            if (products.length !== productIds.length) {
                throw new NotFoundException('Один или несколько товаров не найдены.');
            }
            const inventory = await tx.inventoryItem.findMany({
                where: { productId: { in: productIds } },
                select: { productId: true, onHand: true, reserved: true },
            });
            if (inventory.length !== productIds.length) {
                throw new NotFoundException('Остатки для одного или нескольких товаров не найдены.');
            }
            const productsById = new Map(products.map((product) => [product.id, product]));
            const inventoryByProductId = new Map(inventory.map((item) => [item.productId, item]));
            let totalMinor = 0;
            for (const requested of requestedItems) {
                const product = productsById.get(requested.productId);
                const stock = inventoryByProductId.get(requested.productId);
                if (!product || !stock) {
                    throw new NotFoundException(`Товар или остаток не найден для productId=${requested.productId}.`);
                }
                const available = stock.onHand - stock.reserved;
                if (available < requested.quantity) {
                    throw new ConflictException({
                        statusCode: HttpStatus.CONFLICT,
                        code: 'INSUFFICIENT_STOCK',
                        message: 'Недостаточно товара на складе для выбранного количества.',
                        details: {
                            productId: requested.productId,
                            requested: requested.quantity,
                            available,
                        },
                    });
                }
                totalMinor += product.priceMinor * requested.quantity;
            }
            const order = await tx.order.create({
                data: {
                    customerId: dto.customerId,
                    totalMinor,
                    items: {
                        create: requestedItems.map((requested) => {
                            const product = productsById.get(requested.productId);
                            if (!product) {
                                throw new NotFoundException(`Товар productId=${requested.productId} не найден.`);
                            }
                            return {
                                productId: requested.productId,
                                quantity: requested.quantity,
                                priceMinor: product.priceMinor,
                                totalMinor: product.priceMinor * requested.quantity,
                            };
                        }),
                    },
                },
                include: {
                    items: {
                        select: {
                            id: true,
                            productId: true,
                            quantity: true,
                            priceMinor: true,
                            totalMinor: true,
                        },
                    },
                },
            });
            for (const requested of requestedItems) {
                await tx.inventoryItem.update({
                    where: { productId: requested.productId },
                    data: { reserved: { increment: requested.quantity } },
                });
            }
            return order;
        });
    }
    async cancel(orderId) {
        return this.transitionStatus(orderId, {
            toStatus: OrderStatus.CANCELLED,
            comment: 'Отмена заказа',
        });
    }
    async updateStatus(orderId, dto) {
        this.ensureUpdateStatusPayload(dto);
        return this.transitionStatus(orderId, dto);
    }
    async getById(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    select: {
                        id: true,
                        productId: true,
                        quantity: true,
                        priceMinor: true,
                        totalMinor: true,
                    },
                },
                statusHistory: {
                    select: {
                        id: true,
                        fromStatus: true,
                        toStatus: true,
                        comment: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!order) {
            throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
        }
        return order;
    }
    async ensureCustomerExists(tx, customerId) {
        const customer = await tx.user.findUnique({
            where: { id: customerId },
            select: { id: true },
        });
        if (!customer) {
            throw new NotFoundException(`Покупатель customerId=${customerId} не найден.`);
        }
    }
    aggregateItems(items) {
        const quantities = new Map();
        for (const item of items) {
            quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
        }
        return [...quantities.entries()].map(([productId, quantity]) => ({
            productId,
            quantity,
        }));
    }
    async transitionStatus(orderId, dto) {
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        select: {
                            productId: true,
                            quantity: true,
                        },
                    },
                },
            });
            if (!order) {
                throw new NotFoundException(`Заказ orderId=${orderId} не найден.`);
            }
            this.ensureTransitionAllowed(order.status, dto.toStatus, order.id);
            await this.applyInventoryChangesForTransition(tx, order.items, dto.toStatus);
            return tx.order.update({
                where: { id: order.id },
                data: {
                    status: dto.toStatus,
                    statusHistory: {
                        create: {
                            fromStatus: order.status,
                            toStatus: dto.toStatus,
                            comment: dto.comment ??
                                this.getDefaultTransitionComment(order.status, dto.toStatus),
                        },
                    },
                },
                include: {
                    items: {
                        select: {
                            id: true,
                            productId: true,
                            quantity: true,
                            priceMinor: true,
                            totalMinor: true,
                        },
                    },
                    statusHistory: {
                        select: {
                            id: true,
                            fromStatus: true,
                            toStatus: true,
                            comment: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            });
        });
    }
    ensureTransitionAllowed(fromStatus, toStatus, orderId) {
        const allowed = this.allowedTransitions.get(fromStatus) ?? new Set();
        if (!allowed.has(toStatus)) {
            throw new ConflictException({
                statusCode: HttpStatus.CONFLICT,
                code: 'INVALID_ORDER_STATUS_TRANSITION',
                message: `Недопустимый переход статуса заказа orderId=${orderId}: ${fromStatus} -> ${toStatus}.`,
                details: {
                    orderId,
                    fromStatus,
                    toStatus,
                },
            });
        }
    }
    async applyInventoryChangesForTransition(tx, items, toStatus) {
        if (toStatus === OrderStatus.CANCELLED) {
            await this.decrementReserved(tx, items);
            return;
        }
        if (toStatus === OrderStatus.SHIPPED) {
            await this.shipItems(tx, items);
        }
    }
    async decrementReserved(tx, items) {
        for (const item of items) {
            const inventory = await tx.inventoryItem.findUnique({
                where: { productId: item.productId },
                select: { productId: true, reserved: true },
            });
            if (!inventory) {
                throw new NotFoundException(`Остаток для productId=${item.productId} не найден.`);
            }
            if (inventory.reserved < item.quantity) {
                throw new ConflictException({
                    statusCode: HttpStatus.CONFLICT,
                    code: 'INVENTORY_INVARIANT_VIOLATION',
                    message: `Недопустимое состояние резерва для productId=${item.productId}.`,
                    details: {
                        productId: item.productId,
                        reserved: inventory.reserved,
                        requiredToDecrement: item.quantity,
                    },
                });
            }
            await tx.inventoryItem.update({
                where: { productId: item.productId },
                data: {
                    reserved: {
                        decrement: item.quantity,
                    },
                },
            });
        }
    }
    async shipItems(tx, items) {
        for (const item of items) {
            const inventory = await tx.inventoryItem.findUnique({
                where: { productId: item.productId },
                select: { productId: true, onHand: true, reserved: true },
            });
            if (!inventory) {
                throw new NotFoundException(`Остаток для productId=${item.productId} не найден.`);
            }
            if (inventory.onHand < item.quantity ||
                inventory.reserved < item.quantity) {
                throw new ConflictException({
                    statusCode: HttpStatus.CONFLICT,
                    code: 'INVENTORY_INVARIANT_VIOLATION',
                    message: `Недопустимое состояние склада для отгрузки productId=${item.productId}.`,
                    details: {
                        productId: item.productId,
                        onHand: inventory.onHand,
                        reserved: inventory.reserved,
                        requiredToShip: item.quantity,
                    },
                });
            }
            await tx.inventoryItem.update({
                where: { productId: item.productId },
                data: {
                    onHand: { decrement: item.quantity },
                    reserved: { decrement: item.quantity },
                },
            });
        }
    }
    getDefaultTransitionComment(fromStatus, toStatus) {
        return `Смена статуса заказа: ${fromStatus} -> ${toStatus}`;
    }
    ensureUpdateStatusPayload(dto) {
        if (!dto?.toStatus || !this.statusEndpointAllowedTargets.has(dto.toStatus)) {
            throw new BadRequestException({
                statusCode: HttpStatus.BAD_REQUEST,
                code: 'VALIDATION_ERROR',
                message: 'Входные данные не прошли проверку.',
                errors: [
                    {
                        field: 'toStatus',
                        errors: [
                            'toStatus должен быть одним из значений: CONFIRMED, PACKED, SHIPPED, DELIVERED.',
                        ],
                    },
                ],
            });
        }
    }
};
OrdersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], OrdersService);
export { OrdersService };
//# sourceMappingURL=orders.service.js.map