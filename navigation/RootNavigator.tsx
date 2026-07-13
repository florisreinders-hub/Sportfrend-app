import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { useAuth } from "@/lib/AuthContext";
import { colors } from "@/constants/theme";

import LoginScreen from "@/app/auth/LoginScreen";
import RegisterScreen from "@/app/auth/RegisterScreen";
import RegisterDetailsScreen from "@/app/auth/RegisterDetailsScreen";
import ForgotPasswordScreen from "@/app/auth/ForgotPasswordScreen";
import LocationSetupScreen from "@/app/auth/LocationSetupScreen";

import HomeScreen from "@/app/home/HomeScreen";
import MatchScreen from "@/app/home/MatchScreen";
import FilterScreen from "@/app/home/FilterScreen";
import SporterProfileScreen from "@/app/home/SporterProfileScreen";

import ProfileScreen from "@/app/profile/ProfileScreen";
import EditProfileScreen from "@/app/profile/EditProfileScreen";

import ChatListScreen from "@/app/chat/ChatListScreen";
import ChatDetailScreen from "@/app/chat/ChatDetailScreen";
import NewPostScreen from "@/app/chat/NewPostScreen";

import MenuScreen from "@/app/settings/MenuScreen";
import SettingsScreen from "@/app/settings/SettingsScreen";
import HelpdeskScreen from "@/app/settings/HelpdeskScreen";
import FaqScreen from "@/app/settings/FaqScreen";
import SupportScreen from "@/app/settings/SupportScreen";
import ChangeEmailScreen from "@/app/settings/ChangeEmailScreen";

import PricingScreen from "@/app/premium/PricingScreen";
import PaymentScreen from "@/app/premium/PaymentScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="LocationSetup" component={LocationSetupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="LocationSetup" component={LocationSetupScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Match" component={MatchScreen} />
          <Stack.Screen name="Filter" component={FilterScreen} />
          <Stack.Screen name="SporterProfile" component={SporterProfileScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Menu" component={MenuScreen} />
          <Stack.Screen name="ChatList" component={ChatListScreen} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="NewPost" component={NewPostScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Helpdesk" component={HelpdeskScreen} />
          <Stack.Screen name="Faq" component={FaqScreen} />
          <Stack.Screen name="Support" component={SupportScreen} />
          <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
          <Stack.Screen name="Pricing" component={PricingScreen} />
          <Stack.Screen name="Payment" component={PaymentScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
