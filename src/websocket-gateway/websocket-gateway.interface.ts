import { Socket } from 'socket.io';

export const NOTIFICATION_SOCKET_EVENT = 'notification:delivery';

export interface ISubscribeMembershipRoomDto {
  membershipId?: string;
}

export type TAuthenticatedSocket = Socket & {
  data: {
    userId?: string;
    membershipIds?: string[];
  };
};
