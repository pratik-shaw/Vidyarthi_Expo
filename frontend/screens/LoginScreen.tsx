import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
  Animated,
  Platform,
  SafeAreaView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect } from 'react';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const renderRoleCard = (
    title: string, 
    description: string,
    destination: 'Admin' | 'Student' | 'Teacher', 
    color: string, 
    delay: number
  ) => {
    const cardFade = new Animated.Value(0);
    const cardSlide = new Animated.Value(40);

    useEffect(() => {
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 600,
          delay,
          useNativeDriver: true,
        })
      ]).start();
    }, []);

    return (
        <Animated.View 
          style={[
            styles.roleCardContainer, 
            { 
              opacity: cardFade, 
              transform: [{ translateY: cardSlide }],
            }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.roleCard, { borderLeftColor: color }]}
            onPress={() => navigation.navigate(destination)}
          >
            <View style={styles.roleIconContainer}>
              <View style={[styles.roleDot, { backgroundColor: color }]} />
            </View>
            
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>{title}</Text>
              <Text style={styles.roleDescription}>{description}</Text>
            </View>
            
            <View style={styles.roleArrowContainer}>
              <View style={[styles.roleArrow, { backgroundColor: color }]}>
                <Text style={styles.roleArrowText}>→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    };
  
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Hide the status bar completely */}
        <StatusBar hidden={true} />
        
        <View style={styles.container}>
          <View style={styles.header}>
            <Animated.View 
              style={[
                styles.logoContainer, 
                { 
                  opacity: fadeAnim, 
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Text style={styles.appName}>Vidyarthi</Text>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.titleContainer,
                { 
                  opacity: fadeAnim, 
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Text style={styles.title}>Welcome to your</Text>
              <Text style={styles.subtitle}>Education Management System</Text>
            </Animated.View>
          </View>
  
          <View style={styles.content}>
            <Text style={styles.selectionTitle}>Select your role</Text>
            
            {renderRoleCard(
              'Student', 
              'Access courses, assignments, and grades',
              'Student', 
              '#4E54C8', 
              300
            )}
            
            {renderRoleCard(
              'Teacher', 
              'Manage classes, assignments, and student progress',
              'Teacher', 
              '#1CB5E0', 
              450
            )}
            
            {renderRoleCard(
              'Administrator', 
              'Control system settings and user permissions',
              'Admin', 
              '#3A4276', 
              600
            )}
          </View>
  
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerText}>Need help? Contact support@vidyarthi.edu</Text>
            <Text style={styles.version}>Version 2.4.1</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  };
  
  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#F8F9FC',
    },
    container: {
      flex: 1,
      backgroundColor: '#F8F9FC',
      paddingHorizontal: 24,
    },
    header: {
      paddingTop: 40,
      paddingBottom: 30,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    appName: {
      fontSize: 22,
      fontWeight: '700',
      color: '#3A4276',
    },
    titleContainer: {
      marginBottom: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: '300',
      color: '#3A4276',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#3A4276',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    selectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#3A4276',
      marginBottom: 24,
      opacity: 0.8,
    },
    roleCardContainer: {
      marginBottom: 16,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 4,
    },
    roleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderRadius: 12,
      borderLeftWidth: 4,
      backgroundColor: '#FFFFFF',
    },
    roleIconContainer: {
      position: 'relative',
      marginRight: 16,
    },
    roleDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    roleTextContainer: {
      flex: 1,
    },
    roleTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#3A4276',
      marginBottom: 4,
    },
    roleDescription: {
      fontSize: 14,
      color: '#8A94A6',
      lineHeight: 20,
    },
    roleArrowContainer: {
      marginLeft: 10,
    },
    roleArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleArrowText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    footer: {
      marginTop: 20,
      marginBottom: Platform.OS === 'ios' ? 30 : 20,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: '#8A94A6',
      marginBottom: 5,
    },
    version: {
      fontSize: 12,
      color: '#B0B7C3',
    },
  });
  
  export default LoginScreen;